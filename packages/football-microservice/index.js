/**
 * @author Pierre Obermaier <obermpie@students.zhaw.ch>
 */
const PubNub = require('pubnub');
const ConnectorService = require('./ConnectorService.js');
const objectNormalizer = require('object-normalizer');
const winston = require('winston');
const config = require('config');

winston.configure({
  transports: [
    new (winston.transports.Console) ({level: 'error'}),
    new (winston.transports.File) ({filename: 'info.log', level: process.env.LOG_ENV || 'warn'})
  ]
});

var footballService = new ConnectorService(config.get('FootballService.RSS.feeds'), config.get('FootballService.RSS.pollInterval'));
var _this = footballService;

/**
 * Initialize PubNub keys and subscribe to the relevant channels.
 * @function
 * @memberof ConnectorService
 */
footballService.initPubnub = function() {
  _this.pubnub = new PubNub({
    publishKey: process.env.PUBLISH_KEY,
    subscribeKey: process.env.SUBSCRIBE_KEY
  });
  _this.pubnub.subscribe({
    channels: config.get('FootballService.PubNub.channels')
  });
}

/**
 * Process an item of the feed bringing it in a unified format
 * @function
 * @memberof FootballService
 * @param {Object} item The item/article within the RSS feed that should be processed.
 * @return {Object} The object in the unified format
 */
footballService.processItem = function(item) {
  var i = objectNormalizer.normalize({
    'score': 'description'
  }, item);
  if (i.score === undefined) {
    winston.log('error', 'Unexpected error while casting feed!', item);
    return null;
  }
  i.event = i.score.split(' - ')[1];
  var teams = i.score.split(' vs ');
  i.homeTeam = teams[0].substring(teams[0].lastIndexOf(') ')+2);
  i.guestTeam = teams[1].substring(0, teams[1].indexOf(':'));
  i.score = i.score.split(': ')[1];
  i.score = i.score.substring(0, i.score.indexOf(' ')).replace('-', ' : ');
  winston.log('silly', 'Feed cast to:', i);
  return i;
}

/**
 * Maps game events to our subscription format and our subscription text.
 * Game events mapping to our subscriptions. Notify when (subscriptions === true):
 *   Game event         Subscription
 *   ----------         ------------
 *   Kick Off           events
 *   Goal               goals
 *   Halftime           events
 *   2nd Half Started   events
 *   Match Finished     result || events
 * @function
 * @memberof FootballService
 * @param {string} event The event to be mapped
 * @return {Object}
 */
footballService.mapEvent = function(event) {
  // The replace is fine because the value is only read when it is effectively this event.
  if (!event) {
    winston.log('error', 'There is no event given!')
    return null;
  }
  var text = {
    "Kick Off": "Anstoss",
    "Halftime": "Halbzeit",
    "2nd Half Started": "Beginn der 2. Halbzeit",
    "Goal": event.replace("Goal for", "Tor für"),
    "Match Finished": "Spielende",
    "- Match Postponed": "Spiel verschoben"
  };
  var subscribedEvent;
  if (event === 'Kick Off' || event === 'Halftime' || event === '2nd Half Started' || event === '- Match Postponed') {
    subscribedEvent = {'options.events': true};
  }
  else if (event.substring(0, 4) === 'Goal') {
    subscribedEvent = {'options.goals': true};
    event = 'Goal';
  }
  else if (event === 'Match Finished')
    subscribedEvent = {$or: [{'options.events': true}, {'options.result': true}]};
  else {
    winston.log('error', 'There is no match for the game event "%s"', event)
    return null;
  }

  return {
    isSubscribed: subscribedEvent,
    eventText: text[event]
  };
}

/**
 * Handle update from one of the RSS feeds.
 * @function
 * @memberof ConnectorService
 * @param {Object} item The item/article within the RSS feed that has been updated.
 */
footballService.onItem = function(item) {
  if (item.meta.xmlurl === undefined) {
    return winston.log('error', 'Information {item.meta.xmlurl} of feed missing.');
  }
  var i = _this.processItem(item);
  if (i == null) {
    return winston.log('error', 'There was an error processing an item, skipping rest of onItem handler!');
  }
  if (_this.activeFeeds[item.meta.xmlurl] !== true) { // on first read of feed, old data is read -> handle them only in special cases
    // if the match is not ongoing or the game has finished more than 5 minutes beforehand then ignore it
    var now = new Date();
    if (i.event === 'Match Finished' && (now - item.pubdate) > 5 * 60 * 1000)
      return;
  }

  var s = _this.mapEvent(i.event);
  if (s == null) {
    return winston.log('error', 'There was an error mapping the event, skipping rest of onItem handler!');
  }

  _this.db.find({ $and: [{$or: [{team: i.homeTeam}, {team: i.guestTeam}]}, s.isSubscribed]}, function(err, docs) {
    if (err)
      return winston.log('error', err);
    winston.log('debug', '%d subscribers to notify found for:', docs.length, i);
    if (docs.length > 0) {
      var subs = [];
      docs.forEach(function(doc) {
        subs.push({id: doc.subId});
      });

      var notification = {
        message: 'notify',
        data: {
          notificationMessage: s.eventText + ' - ' + i.homeTeam + ' ' + i.score + ' ' + i.guestTeam,
          subscriptions: subs
        }
      }
      _this.notify(notification);
    }
  });
}

/**
 * Handler to add subscriptions to be notified by service.
 * @function
 * @memberof ConnectorService
 * @param {Object} s The message containing a single subscription.
 * @param {string} s.id The ID of the subscription.
 * @param {Object} s.data The specific data/options of the subscription.
 * @param {string} s.data.team The team the subscriber wants to be notified for.
 * @param {boolean} s.data.goals Does the subscriber want to be notified for all goals in matches of his team?
 * @param {boolean} s.data.events Does the subscriber want to be notified for all game events in matches of his team?
 * @param {boolean} s.data.result Does the subscriber want to be notified for the end result for matches of his team?
 * @param {requestCallback} cb The callback that handles the response.
 */
footballService.addSubscription = function(s, cb) {
  var doc = objectNormalizer.normalize({
    'subId': 'id',
    'team': 'data.team',
    'options': {
      'goals': 'data.goals',
      'events': 'data.events',
      'result': 'data.result'
    }
  }, s);

  winston.log('debug', doc);
  if (doc.subId === undefined || doc.team === undefined)
    return cb(new Error('Invalid subscription format: '+JSON.stringify(doc)));

  _this.db.insert(doc, cb);
}

/**
 * Handler to remove subscriptions from the service.
 * @function
 * @memberof ConnectorService
 * @param {Object} s The message containing a single unsubscription.
 * @param {string} s.id The ID of the subscription as received while subscribing.
 * @param {requestCallback} cb The callback that handles the response.
 */
footballService.removeSubscription = function(s, cb) {
  winston.log('debug', s);

  if (s.id === undefined)
    return cb(new Error('Invalid unsubscription format: '+JSON.stringify(s)));

  _this.db.remove({ subId: s.id }, {}, cb);
}

module.exports = footballService;
