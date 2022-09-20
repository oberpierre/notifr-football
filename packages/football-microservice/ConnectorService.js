/**
 * @author Pierre Obermaier <obermpie@students.zhaw.ch>
 */
const http = require('http');
const FeedPoller = require('feed-poller');
const Datastore = require('nedb');
const winston = require('winston');
const config = require('config');

winston.configure({
  transports: [
    new (winston.transports.Console) ({level: 'error'}),
    new (winston.transports.File) ({filename: 'info.log', level: process.env.LOG_ENV || 'warn'})
  ]
});

if (!process.env.BACKEND_HOST) {
  winston.log('error', 'No backend specified! Exiting...');
  process.exit(1);
}

/**
 * @class
 * @classdesc Represents a microservice connecting to an RSS feed.
 */
class ConnectorService {

  /**
   * Instantiate a ConstructorService object
   * @constructor
   * @memberof ConnectorService
   * @param {string[]} feeds The feed(s) that should be polled.
   * @param {number} interval The interval in seconds in which the RSS feed(s) is/are to be polled.
   */
  constructor(feeds, interval) {
    var _this = this;
    this.db = new Datastore();
    this.db.ensureIndex({ fieldName: 'subId', unique: true }, function(err) {
      if (err)
        winston.log('warn', err);
    });
    this.feedPoller = new FeedPoller(feeds, interval || 3600);
    this.feedPoller.on('error', function(err) {
      winston.log('error', err);
    });
    this.activeFeeds = {};
    for (var i = 0;i < feeds.length;i++) {
      this.activeFeeds[feeds[i]] = false;
    }
    var activateFeeds = function(feedUrl) {
      winston.log('silly', '%s has just been polled', feedUrl);
      _this.activeFeeds[feedUrl] = true;
      var removable = true;
      var values = Object.keys(_this.activeFeeds).map(function(key) {
        return _this.activeFeeds[key];
      });
      for (var i = 0;i < values.length;i++) {
        removable = removable && values[i];
      }
      if (removable) {
        winston.log('silly', 'activateFeeds listener removed');
        _this.feedPoller.removeListener('end', activateFeeds);
        activateFeeds = undefined;
      }
    }
    this.feedPoller.on('end', activateFeeds);
  }

  /**
   * Initialize PubNub keys and subscribe to the relevant channels.
   * @abstract
   * @function
   * @memberof ConnectorService
   */
  initPubnub() {
    winston.log('error', 'Must be implemented by subclass!');
    throw new Error('Must be implemented by subclass!');
  }

  /**
   * Handle update from one of the RSS feeds.
   * @abstract
   * @function
   * @memberof ConnectorService
   * @param {Object} item The item/article within the RSS feed that has been updated.
   */
  onItem(item) {
    winston.log('error', 'Must be implemented by subclass!', item);
    throw new Error('Must be implemented by subclass!');
  }

  /**
   * Handle incoming subscriptions events.
   * Determines wether subscriptions are to be added or removed.
   * @function
   * @memberof ConnectorService
   * @param {Object} s The message containing the (un)subscriptions.
   * @param {string} s.message The type of the message determining if it's a subscription or unsubscription.
   * @param {Object} s.data The relevant data of the message depending on its type.
   */
  handleSubscriptions(s) {
    winston.log('debug', 'handleSubscriptions#start', s);

    if (s.message === 'subscriptions' || s.message === 'subscribe') {
      var subs = s.data.subscriptions;
      /** @callback cb */
      var addCb = function(err, newDoc) {
        if (err)
          return winston.log('error', err);
        winston.log('debug', 'Subscription added.', newDoc);
      }
      for (var i = 0;i < subs.length;i++) {
        this.addSubscription(subs[i], addCb);
      }
    }
    else if (s.message === 'unsubscribe') {
      var unsubs = s.data.subscriptions;
      var removeCb = function(err, numRemoved) {
        if (err)
          return winston.log('error', err);
        winston.log('debug', '%d documents removed.', numRemoved);
      }
      for (var j = 0;j < unsubs.length;j++) {
        this.removeSubscription(unsubs[j], removeCb);
      }
    }
  }

  /**
   * Handler to add subscriptions to be notified by service.
   * @abstract
   * @function
   * @memberof ConnectorService
   * @param {Object} s The message containing a single subscription.
   * @param {string} s.id The ID of the subscription.
   * @param {requestCallback} cb The callback that handles the response.
   */
  addSubscription(s, cb) {
    winston.log('error', 'Must be implemented by subclass!', s);
    throw new Error('Must be implemented by subclass!');
  }

  /**
   * Handler to remove subscriptions from the service.
   * @abstract
   * @function
   * @memberof ConnectorService
   * @param {Object} s The message containing a single unsubscription.
   * @param {string} s.id The ID of the subscription as received while subscribing.
   * @param {requestCallback} cb The callback that handles the response.
   */
  removeSubscription(s, cb) {
    winston.log('error', 'Must be implemented by subclass!', s);
    throw new Error('Must be implemented by subclass!');
  }

  /**
   * Receive subscriptions registered for this service from the backend.
   * @function
   * @memberof ConnectorService
   */
  getSubscriptions() {
    var _this = this;
    http.get('http://'+ process.env.BACKEND_HOST + '/api/connectors/football/subscriptions/', function(res) {
      if (res.statusCode === 200 || res.statusCode === 201) {
        res.setEncoding('utf-8');
        res.on('data', function(s) {
          winston.log('debug', 'Subscriptions received:', s);
          try {
            _this.handleSubscriptions(JSON.parse(s));
          } catch (err) {
            winston.log('error', 'There was a problem getting subscriptions: %s', err);
          }
        });
      }
      else {
        winston.log('error', 'Unexpected status code %d returned from the server while getting subscriptions!', res.statusCode);
      }
    }).on('error', function(err) {
      winston.log('error', 'Error while getting subscriptions: %s', err);
    });
  }

  /**
   * Send the notifications for affected subscriptions to the backend.
   * @function
   * @memberof ConnectorService
   * @param {Object} m The notification message.
   * @param {string} m.message Type of message. (For notification usually 'notify')
   * @param {Object} m.data The data of the effective message.
   * @param {string} m.data.notificationMessage The actual message which will be delivered to the subscribers.
   * @param {Object[]} m.data.subscriptions All the affected subscriptions for which the notification is relevant.
   * @param {string} m.data.subscriptions[].id The ID of the subscription as received while subscribing.
   */
   notify(m) {
     winston.log('debug', 'Notify:', m);
     try {
       var postData = JSON.stringify(m);

       var req = http.request({
         hostname: process.env.BACKEND_HOST,
         port: 80,
         path: '/api/notifications/',
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'Content-Length': Buffer.byteLength(postData)
         }
       }, function(res) {
         if (res.statusCode == 200)
           winston.log('info', 'Notification(s) send successfully');
         else
           winston.log('error', 'Unexpected status code %d returned from server while sending notifications!', res.statusCode);
       });

       req.on('error', function(err) {
         winston.log('error', err);
       });
       req.write(postData);
       req.end();
     } catch (err) {
       winston.log('error', 'There was a problem sending notifications: %s', err);
     }
   }

  /**
   * Start polling feeds, listening to PubNub and notifying subscribers for relevant updates.
   * @function
   * @memberof ConnectorService
   */
  start() {
    winston.log('silly', '#start()');
    var _this = this;

    this.feedPoller.on('item', this.onItem);

    this.initPubnub();
    this.getSubscriptions();
    this.pubnubListener = {
      status: function(s) {
        if (s.category === "PNConnectedCategory") {
          winston.log('info', 'Start polling feeds');
          _this.feedPoller.start();
        }
        else {
          winston.log('error', 'Unexpected Status of category "%s"!', s.category);
        }
      },
      message: function(m) {
        var s = JSON.parse(m.message);
        _this.handleSubscriptions(s);
      }
    }
    this.pubnub.addListener(this.pubnubListener);
  }

  /**
   * Stop polling feeds, listening to PubNub and therefore notifying subscribers.
   * @function
   * @memberof ConnectorService
   */
  stop() {
    winston.log('silly', '#stop()');
    this.feedPoller.stop();
    this.feedPoller.removeListener('item', this.onItem);
    this.pubnub.removeListener(this.pubnubListener);
  }

}

module.exports = ConnectorService;
