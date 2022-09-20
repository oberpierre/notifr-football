/**
 * @author Pierre Obermaier <obermpie@students.zhaw.ch>
 */
const EventEmitter = require('events').EventEmitter;
const request = require('request');
const FeedParser = require('feedparser');
const _ = require('underscore');

/**
 * @class
 * @classdesc
 */
class FeedPoller {

  /**
   * Creates a FeedPoller object.
   * @constructor
   * @param {string[]} feeds The feed(s) that should be polled.
   * @param {number} interval The interval in seconds in which the RSS feed(s) is/are to be polled.
   */
  constructor(feeds, interval) {
    this.feeds = feeds;
    this.interval = (interval || 3600) * 1000;
    this.emitter = new EventEmitter();
    this.cache = {};
  }

  /**
   * Registers an event listener.
   * @function on
   * @memberof FeedPoller
   * @param {string} event The event type the listener should be registered for.
   * @param {requestCallback} cb The handler that is called when the event occurs.
   */
  on(event, cb) {
    this.emitter.on(event, cb);
  }

  /**
   * Removes an event listener.
   * @function removeListener
   * @memberof FeedPoller
   * @param {string} event The event type the listener should be removed from.
   * @param {requestCallback} cb The handler previously registered to be called when the event occurs.
   */
  removeListener(event, cb) {
    this.emitter.removeListener(event, cb);
  }

  /**
   * Starts polling the feed(s) in the specified interval.
   * @function start
   * @memberof FeedPoller
   */
  start() {
    var _this = this;
    this.pollAll();
    this.interval_id = setInterval(function() {
      _this.pollAll();
    }, this.interval);
  }

  /**
   * Stop polling the feed(s).
   * @function stop
   * @memberof FeedPoller
   */
  stop() {
    clearInterval(this.interval_id);
  }

  /**
   * Polls all feeds.
   * @function pollAll
   * @memberof FeedPoller
   */
  pollAll() {
    var _this = this;
    function next(i) {
      var feed = _this.feeds[i];
      if (!feed)
        return;
      _this.poll(feed, function() {
        next(i+1);
      });
    }
    next(0);
  }

  /**
   * Polls the specified feed.
   * @function poll
   * @memberof FeedPoller
   * @param {string} feedUrl The url to the feed to be polled.
   * @param {requestCallback} cb The handler on what to do after the processing is done.
   */
  poll(feedUrl, cb) {
    var _this = this;
    var feedparser = new FeedParser();

    feedparser.on('error', function(err) {
      _this.emitter.emit('error', err);
    });
    feedparser.on('end', function(err) {
      if (err)
        _this.emitter.emit('error', err);
      _this.emitter.emit('end', feedUrl);
    });
    feedparser.on('readable', function() { // this is where the magic happens
      var stream = this;
      var item;

      while (item = stream.read()) {
        var latest = _this.cache[item.guid];
        if (!latest || item.pubdate > latest) {
          _this.emitter.emit('item', item);
          _this.cache[item.guid] = item.pubdate;
        }
      }
    });

    request.get(feedUrl)
    .on('error', function(err) {
      _this.emitter.emit('error', err);
    })
    .on('response', function(response) {
      if (response.statusCode !== 200) {
        _this.emitter.emit('error', new Error('Bad status code: '+response.statusCode));
        _this.emitter.emit('end', feedUrl);
      }
      else {
        this.pipe(feedparser);
      }
    });
    cb();
  }

}

module.exports = FeedPoller;
