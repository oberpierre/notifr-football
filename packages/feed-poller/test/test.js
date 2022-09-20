const fs = require('fs');
const http = require('http');
const sinon = require('sinon');
const should = require('should');
require('should-sinon');

const FeedPoller = require('../index.js');

var port = undefined;

describe('FeedPoller', function() {

  Object.defineProperty(global, "name_of_leaking_property", {
    set : function(value) {
        throw new Error("Found the leak!");
    }
  });

  before('Set up file server', function (done) {
    var server = http.createServer(function(req, res) {
      if (req.url === '/notfound') {
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Encoding', 'utf-8');
        res.statusCode = 404;
        res.statusMessage = 'Not found';
        res.end();
      }
      else {
        var stream = fs.createReadStream(require('path').resolve(__dirname, 'feeds' + req.url));
        res.setHeader('Content-Type', 'text/xml');
        res.setHeader('Content-Encoding', 'utf-8');
        stream.pipe(res);
      }
    });

    server.listen(0, function() {
      port = this.address().port;
      done();
    });
  });

  describe('#poll', function() {
    it('should read the RSS feed specified once', function(done) {
      var feed = 'http://localhost:' + port + '/championsleague.xml';
      var poller = new FeedPoller([], 15);

      var items = 0;
      poller.on('item', function(item) {
        item.title.should.be.a.String();
        items++;
      });
      poller.on('error', done);
      poller.on('end', function(feedUrl) {
        feed.should.equal(feedUrl);
        items.should.equal(8);
        done();
      });
      poller.poll(feed, function() {});
    });
    it('should read the Atom feed specified once', function(done) {
      var feed = 'http://localhost:' + port + '/livesoccer.xml';
      var poller = new FeedPoller([], 15);

      var items = 0;
      poller.on('item', function(item) {
        item.title.should.be.a.String();
        items++;
      });
      poller.on('error', done);
      poller.on('end', function(feedUrl) {
        feed.should.equal(feedUrl);
        items.should.equal(10);
        done();
      });
      poller.poll(feed, function() {});
    });
    it('should return every article of a feed', function(done) {
      var feed = 'http://localhost:' + port + '/championsleague.xml';
      var poller = new FeedPoller([], 15);

      var titles = {
        'Dortmund - AS Monaco (Di. 11.04. 20:45 Uhr)': true,
        'Juventus - FC Barcelona (Di. 11.04. 20:45 Uhr)': true,
        'Bayern - Real Madrid (Mi. 12.04. 20:45 Uhr)': true,
        'Atl. Madrid - Leicester City (Mi. 12.04. 20:45 Uhr)': true,
        'Leicester - Atletico Madrid (Di. 18.04. 20:45 Uhr)': true,
        'Real Madrid - Bayern München (Di. 18.04. 20:45 Uhr)': true,
        'Barcelona - Juventus Turin (Mi. 19.04. 20:45 Uhr)': true,
        'Monaco - Borussia Dortmund (Mi. 19.04. 20:45 Uhr)': true
      };

      poller.on('item', function(item) {
        titles[item.title].should.be.true();
        delete(titles[item.title]);
      });
      poller.on('error', done);
      poller.on('end', function(feedUrl) {
        feed.should.equal(feedUrl);
        done();
      });
      poller.poll(feed, function() {});
    });
    it('should not invoke callbacks after listener has been removed', function(done) {
      var feed1 = 'http://localhost:' + port + '/championsleague.xml';
      var feed2 = 'http://localhost:' + port + '/livesoccer.xml';

      var poller = new FeedPoller([], 15);
      var spy = sinon.spy();
      poller.on('item', spy),
      poller.poll(feed1, function() {});
      setTimeout(function() {
        spy.should.have.callCount(8);
        poller.removeListener('item', spy);
        poller.poll(feed2, function() {});
        setTimeout(function() {
          spy.should.have.callCount(8);
          done();
        }, 50);
      }, 50);
    });
    it('should throw an error if the resource doesn\'t exits', function(done) {
      var feed = 'http://thisresourcedoesnotexistatall.com/rss.xml';
      var poller = new FeedPoller([], 15);

      var itemSpy = sinon.spy();
      var errorSpy = sinon.spy();
      poller.on('item', itemSpy)
      poller.on('error', errorSpy);
      poller.poll(feed, function() {});
      setTimeout(function() {
        itemSpy.should.not.be.called();
        errorSpy.should.be.called();
        done();
      }, 50);
    });
    it('should throw an error if the resource is not an actual feed', function(done) {
      var feed = 'http://localhost:' + port + '/random.txt';
      var poller = new FeedPoller([], 15);

      var itemSpy = sinon.spy();
      var errorSpy = sinon.spy();
      poller.on('item', itemSpy)
      poller.on('error', errorSpy);
      poller.on('end', function() {
        itemSpy.should.not.be.called();
        errorSpy.should.be.called();
        done();
      });
      poller.poll(feed, function() {});
    });
    it('should throw an error if the response code is not 200', function(done) {
      var feed = 'http://localhost:' + port + '/notfound';
      var poller = new FeedPoller([], 15);

      var itemSpy = sinon.spy();
      var errorSpy = sinon.spy();
      poller.on('item', itemSpy);
      poller.on('error', errorSpy);
      poller.on('end', function() {
        itemSpy.should.not.be.called();
        errorSpy.should.be.called();
        errorSpy.getCall(0).args[0].should.deepEqual(new Error('Bad status code: 404'));
        done();
      });
      poller.poll(feed, function() {});
    })
  });

  describe('#pollAll', function() {
    it('should read all feeds specified once', function(done) {
      var poller = new FeedPoller([
        'http://localhost:' + port + '/championsleague.xml',
        'http://localhost:' + port + '/livesoccer.xml'
      ], 15);

      var items = 0;
      poller.on('item', function(item) {
        item.title.should.be.a.String();
        items++;
      });
      poller.on('error', done);
      poller.pollAll();
      setTimeout(function() {
        items.should.equal(18);
        done();
      }, 50);
    });
  });

  describe('#start', function() {

    var changeFile = function(dir, baseFile, ix) {
      var i = baseFile.indexOf('.');
      var file = baseFile.substring(0, i) + ix + baseFile.substring(i);
      fs.unlinkSync(dir + baseFile);
      var data = fs.readFileSync(dir + file);
      fs.writeFileSync(dir + baseFile, data);
    }

    after('file cleanup', function() {
      changeFile(__dirname + '/feeds/', 'championsleague.xml', 0);
      changeFile(__dirname + '/feeds/', 'livesoccer.xml', 0);
    });

    it('should invoke pollAll about all x seconds as specified', function(done) {
      var p1 = new FeedPoller([], 0.1);

      start = undefined;
      p1.pollAll = function() {
        now = new Date();
        if (start !== undefined) {
          (now - start).should.be.approximately(100, 25);
        }
        start = new Date();
      }
      p1.start();
      setTimeout(function() {
        p1.stop();
        var p2 = new FeedPoller([], 1);

        start = undefined;
        p2.pollAll = function() {
          now = new Date();
          if (start !== undefined) {
            (now - start).should.be.approximately(1000, 25);
          }
          start = now;
        }
        setTimeout(function() {
          p2.stop();
          done();
        }, 3500);
      }, 200);
    });
    it('should invoke callback for all items in the feeds and then for changes in them only', function(done) {
      var file1 = 'championsleague.xml';
      var file2 = 'livesoccer.xml';
      var poller = new FeedPoller([
        'http://localhost:' + port + '/' + file1,
        'http://localhost:' + port + '/' + file2
      ], 0.1);

      var i = 0;
      var items = 0;
      var pollAll = poller.pollAll.bind(poller);
      poller.pollAll = function() {
        pollAll();
        if (i < 4) {
          changeFile(__dirname + '/feeds/', file1, i);
          changeFile(__dirname + '/feeds/', file2, i);
          i++;
        }
      }
      poller.on('item', function(item) {
        items++;
      });
      poller.on('error', done);
      poller.start();
      setTimeout(function() {
        poller.stop();
        // cl = championsleague, ls = livesoccer
        // [18 on first iteration over both] + [2 in cl] + [1 in cl & 2 in ls] + [2 in cl] = 2
        items.should.equal(25);
        done();
      }, 800);
    });
  });

  describe('#stop', function() {
    it('should not invoke callbacks after it\'s stopped', function(done) {
      var poller = new FeedPoller([
        'http://localhost:' + port + '/championsleague.xml',
        'http://localhost:' + port + '/livesoccer.xml'
      ], 100);

      var startSpy = sinon.spy();
      var stopSpy = sinon.spy();

      poller.start();
      poller.on('item', startSpy);
      poller.on('error', done);
      setTimeout(function() {
        poller.stop();
        poller.on('item', stopSpy);
        setTimeout(function() {
          startSpy.should.be.called();
          startSpy.should.have.callCount(18);
          stopSpy.should.not.be.called();
          done();
        }, 500);
      }, 200);
    });
  });

});
