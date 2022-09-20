const sinon = require('sinon');
const should = require('should');
require('should-sinon');

const ConnectorService = require('../ConnectorService.js');
var connectorService;
const footballService = require('../index.js');

describe('microservice.football', function() {

  Object.defineProperty(global, "name_of_leaking_property", {
    set : function(value) {
      throw new Error("Found the leak!");
    }
  });

  describe('ConnectorService', function() {

    beforeEach('Instantiate ConnectorService', function() {
      connectorService = new ConnectorService([], 1000);
      sinon.spy(connectorService, 'initPubnub');
      sinon.spy(connectorService, 'addSubscription');
      sinon.spy(connectorService, 'removeSubscription');
      sinon.spy(connectorService, 'onItem');
    });

    describe('#initPubnub()', function() {
      it('should throw an error', function() {
        try {
          connectorService.initPubnub();
        } catch (e) {}
        connectorService.initPubnub.should.be.called();
        connectorService.initPubnub.should.threw();
      });
    });
    describe('#addSubscription()', function() {
      it('should throw an error', function() {
        var subs = [];
        for(var i = 0; i < 10; i++) {
          subs.push({
            id: i,
            data: {
              team: ''+i,
              goals: true,
              events: true,
              result: true
            }
          });
        }
        try {
          connectorService.handleSubscriptions({
            message: 'subscriptions',
            data: {
              subscriptions: subs
            }
          });
        } catch (e) {}
        connectorService.addSubscription.should.be.called();
        connectorService.addSubscription.should.alwaysThrew();
      });
    });
    describe('#removeSubscription()', function() {
      it('should throw an error', function() {
        var unsubs = [];
        for(var i = 0; i < 10; i++) {
          unsubs.push({
            id: i,
          });
        }
        try {
          connectorService.handleSubscriptions({
            message: 'unsubscribe',
            data: {
              subscriptions: unsubs
            }
          });
        } catch (e) {}
        connectorService.removeSubscription.should.be.called();
        connectorService.removeSubscription.should.alwaysThrew();
      });
    });
    describe('#onItem()', function() {
      it('should throw an error', function() {
        try {
          connectorService.onItem({});
        } catch (e) {}
        connectorService.onItem.should.be.called();
        connectorService.onItem.should.threw();
      });
    });
    describe('#start()', function() {
      it('should call specific functions', function() {
        connectorService.feedPoller = {
          on: sinon.spy()
        }
        connectorService.initPubnub = sinon.spy();
        connectorService.pubnub = {
          addListener: sinon.spy()
        };
        connectorService.getSubscriptions = sinon.spy();
        connectorService.start();
        connectorService.feedPoller.on.should.have.callCount(1);
        connectorService.feedPoller.on.should.be.calledWithExactly('item', connectorService.onItem);
        connectorService.initPubnub.should.have.callCount(1);
        connectorService.getSubscriptions.should.have.callCount(1);
        connectorService.pubnub.addListener.should.have.callCount(1);
      });
    });
    describe('#stop()', function() {
      it('should call specific function', function() {
        connectorService.feedPoller = {
          on: function() {},
          stop: sinon.spy(),
          removeListener: sinon.spy()
        };
        connectorService.pubnub = {
          addListener: function() {},
          removeListener: sinon.spy()
        };
        connectorService.initPubnub = function() {};
        connectorService.getSubscriptions = function() {};
        connectorService.start();
        connectorService.stop();
        connectorService.feedPoller.stop.should.have.callCount(1);
        connectorService.feedPoller.removeListener.should.have.callCount(1),
        connectorService.feedPoller.removeListener.should.be.calledWithExactly('item', connectorService.onItem);
        connectorService.pubnub.removeListener.should.have.callCount(1);
        connectorService.pubnub.removeListener.should.be.calledWithExactly(connectorService.pubnubListener);
      });
    });
  });

  describe('FootballService', function() {
    describe('#handleSubscriptions()', function() {

      beforeEach(function(done) {
        footballService.db.remove({}, {multi: true}, function(err, numRemoved) {
          done();
        });
      });

      describe('#addSubscription', function() {
        it('should accept subscripitons', function(done) {
          var subs = [];
          for (var i = 0;i < 10;i++) {
            subs.push({
              id: i,
              data: {
                team: ''+i,
                goals: (i & 1 ? true : false),
                events: (i & 2 ? true : false),
                result: (i & 4 ? true : false)
              }
            });
          }
          footballService.handleSubscriptions({
            message: 'subscriptions',
            data: {
              subscriptions: subs
            }
          });
          var sub = {
            id: 9999,
            data: {
              team: 'Borussia Dortmund',
              goals: true,
              events: true,
              result: true
            }
          }
          footballService.handleSubscriptions({
            message: 'subscribe',
            data: {
              subscriptions: [
                sub
              ]
            }
          });
          footballService.db.find({}, function(err, docs) {
            should.not.exist(err);
            subs.push(sub);
            docs.should.be.instanceof(Array).and.have.lengthOf(subs.length);
            for (var i = 0;i < docs.length;i++) {
              var doc = docs[i];
              var ix;
              if (doc.subId === 9999)
                ix = 10;
              else
                ix = doc.subId;
              doc.subId.should.equal(subs[ix].id);
              doc.team.should.equal(subs[ix].data.team);
              doc.options.goals.should.equal(subs[ix].data.goals);
              doc.options.events.should.equal(subs[ix].data.events);
              doc.options.result.should.equal(subs[ix].data.result);
            }
            done();
          });
        });
        it('should handle duplicate subscriptions in message subsribe', function(done) {
          var sub = {
            id: 1,
            data: {
              team: 'Chelsea',
              goals: true,
              events: true,
              result: true
            }
          };
          var subscription = {
            message: 'subscribe',
            data: {
              subscriptions: [
                sub
              ]
            }
          }
          footballService.handleSubscriptions(subscription);
          footballService.handleSubscriptions(subscription);
          footballService.db.find({}, function(err, docs) {
            should.not.exist(err);
            docs.should.have.lengthOf(1);
            done();
          });
        });
        it('should handle duplicate subscriptions in message subscriptions', function(done) {
          var sub = {
            id: 1,
            data: {
              team: 'Arsenal',
              goals: true,
              events: true,
              result: true
            }
          };
          footballService.handleSubscriptions({
            message: 'subscriptions',
            data: {
              subscriptions: [
                sub, sub, sub, sub
              ]
            }
          });
          footballService.db.find({}, function(err, docs) {
            should.not.exist(err);
            docs.should.have.lengthOf(1);
            done();
          });
        });
        it('should return an error for malformated subscriptions', function() {
          var msg1 = {
            data: {
              team: 'Borussia Dortmund'
            }
          };
          footballService.addSubscription(msg1, function(err, newDoc) {
            should.not.exist(newDoc);
            err.should.be.deepEqual(new Error('Invalid subscription format: '+JSON.stringify({
              subId: undefined,
              team: 'Borussia Dortmund',
              options: {
                goals: undefined,
                events: undefined,
                result: undefined
              }
            })));
            var msg2 = {
              id: 1
            };
            footballService.addSubscription(msg2, function(err, newDoc) {
              should.not.exist(newDoc);
              err.should.be.deepEqual(new Error('Invalid subscription format: '+JSON.stringify({
                subId: 1,
                team: undefined,
                options: {
                  goals: undefined,
                  events: undefined,
                  result: undefined
                }
              })));
            });
          });
        });
      });
      describe('#removeSubscription()', function() {
        it('should remove subscriptions', function(done) {
          var subs = [];
          for(var i = 0; i < 10; i++) {
            subs.push({
              id: i,
              data: {
                team: ''+i,
                goals: true,
                events: true,
                result: true
              }
            });
          }
          footballService.handleSubscriptions({
            message: 'subscriptions',
            data: {
              subscriptions: subs
            }
          });
          var unsubs = [];
          for(var i = 5; i < subs.length; i++) {
            unsubs.push({id: i});
          }
          footballService.handleSubscriptions({
            message: 'unsubscribe',
            data: {
              subscriptions: unsubs
            }
          });
          footballService.db.find({}, function(err, docs) {
            should.not.exist(err);
            docs.should.have.lengthOf(5);
            for(var i = 3; i < subs.length; i++) {
              footballService.handleSubscriptions({
                message: 'unsubscribe',
                data: {
                  subscriptions: [
                    {id: i}
                  ]
                }
              });
            }
            footballService.db.find({}, function(err, docs) {
              should.not.exist(err);
              docs.should.have.lengthOf(3);
              var ids = [0, 1, 2];
              for (var i = 0; i < docs.length; i++) {
                docs[i].subId.should.be.oneOf(ids);
              }
              done();
            });
          });
        });
      });
    });

    describe('#processItem()', function() {
      it('should return null if item cannot be processed', function() {
        should.not.exist(footballService.processItem());
        should.not.exist(footballService.processItem(null));
        should.not.exist(footballService.processItem(undefined));
        should.not.exist(footballService.processItem(false));
        should.not.exist(footballService.processItem({}));
        should.not.exist(footballService.processItem({title: 'asdf'}));
        should.not.exist(footballService.processItem({whadup: 'thuglife'}));
      });
      it('should process the item properly', function() {
        var descriptions = ['(USA-MLS) Portland Timbers vs New England Revolution: 1-1 - Match Finished',
                            '(GER-BL) TSG Hoffenheim vs Vfl Wolfsburg: 0-0 - Kick Off',
                            '(GER-BL) Freiburg vs FC Bayern: 5-0 - Goal for Freiburg',
                            '(GER-BL) FC Ingolstadt 04 vs RB Leipzig: 0-1 - Halftime',
                            '(GER-BL) FC Bayern vs Vfl Wolfsburg: 2-1 - 2nd Half Started'
                          ];
        var events = ['Match Finished', 'Kick Off', 'Goal for Freiburg', 'Halftime', '2nd Half Started'];
        var homeTeams = ['Portland Timbers', 'TSG Hoffenheim', 'Freiburg', 'FC Ingolstadt 04', 'FC Bayern'];
        var guestTeams = ['New England Revolution', 'Vfl Wolfsburg', 'FC Bayern', 'RB Leipzig', 'Vfl Wolfsburg']
        var scores = ['1 : 1', '0 : 0', '5 : 0', '0 : 1', '2 : 1'];
        for (var i = 0;i < descriptions.length;i++) {
          var obj = footballService.processItem({
            description: descriptions[i]
          });
          obj.event.should.equal(events[i]);
          obj.homeTeam.should.equal(homeTeams[i]);
          obj.guestTeam.should.equal(guestTeams[i]);
          obj.score.should.equal(scores[i]);
        }
      });
    });

    describe('#mapEvent()', function() {
      it('should return null for unknown events', function() {
        should.not.exist(footballService.mapEvent());
        should.not.exist(footballService.mapEvent(''));
        should.not.exist(footballService.mapEvent('Random'));
        should.not.exist(footballService.mapEvent(null));
        should.not.exist(footballService.mapEvent(undefined));
        should.not.exist(footballService.mapEvent(false));
      });

      it('should properly map known events', function() {
        footballService.mapEvent('Kick Off').should.deepEqual({
          isSubscribed: {'options.events': true},
          eventText: 'Anstoss'
        });
        footballService.mapEvent('Halftime').should.deepEqual({
          isSubscribed: {'options.events': true},
          eventText: 'Halbzeit'
        });
        footballService.mapEvent('2nd Half Started').should.deepEqual({
          isSubscribed: {'options.events': true},
          eventText: 'Beginn der 2. Halbzeit'
        });
        footballService.mapEvent('Match Finished').should.deepEqual({
          isSubscribed: {$or: [{'options.events': true}, {'options.result': true}]},
          eventText: 'Spielende'
        });
        footballService.mapEvent('Goal for Borussia Dortmund').should.deepEqual({
          isSubscribed: {'options.goals': true},
          eventText: 'Tor für Borussia Dortmund'
        });
        footballService.mapEvent('Goal for Bayern Munich').should.deepEqual({
          isSubscribed: {'options.goals': true},
          eventText: 'Tor für Bayern Munich'
        });
      });
    });

    describe('#notify()', function() {

      before('add subscriptions', function(done) {
        footballService.db.remove({}, {multi: true}, function(err, numRemoved) {
          should.not.exist(err);
          footballService.handleSubscriptions({
            message: 'subscriptions',
            data: {
              subscriptions: [
                {
                  id: 0,
                  data: {
                    team: 'Borussia Dortmund',
                    goals: true,
                    events: true,
                    result: true
                  }
                },
                {
                  id: 1,
                  data: {
                    team: 'FC Bayern',
                    goals: false,
                    events: false,
                    result: true
                  }
                },
                {
                  id: 2,
                  data: {
                    team: 'Freiburg',
                    goals: false,
                    events: true,
                    result: false
                  }
                },
                {
                  id: 3,
                  data: {
                    team: 'Vfl Wolfsburg',
                    goals: true,
                    events: false,
                    result: true
                  }
                }
              ]
            }
          });
          done();
        });
      });

      it('should discard updates noone is subscribed for', function() {
        footballService.notify = sinon.spy();
        footballService.onItem({
          description: '(USA-MLS) Portland Timbers vs New England Revolution: 1-1 - Match Finished',
          meta: {
            xmlurl: 'http://www.scorespro.com/rss2/live-soccer.xml',
            xmlUrl: 'http://www.scorespro.com/rss2/live-soccer.xml'
          }
        });
        footballService.onItem({
          description: '(GER-BL) FC Bayern vs Vfl Wolfsburg: 0-0 - Kick Off',
          meta: {
            xmlurl: 'http://www.scorespro.com/rss2/live-soccer.xml',
            xmlUrl: 'http://www.scorespro.com/rss2/live-soccer.xml'
          }
        });
        footballService.onItem({
          description: '(GER-BL) Freiburg vs FC Bayern: 5-0 - Goal for Freiburg',
          meta: {
            xmlurl: 'http://www.scorespro.com/rss2/live-soccer.xml',
            xmlUrl: 'http://www.scorespro.com/rss2/live-soccer.xml'
          }
        });
        footballService.onItem({
          description: '(GER-BL) FC Bayern vs Vfl Wolfsburg: 0-0 - 2nd Half Started',
          meta: {
            xmlurl: 'http://www.scorespro.com/rss2/live-soccer.xml',
            xmlUrl: 'http://www.scorespro.com/rss2/live-soccer.xml'
          }
        });
        footballService.onItem({
          description: '(SLV-CL) Alianza FC vs Dragon: 3-1 - Goal for Alianza',
          meta: {
            xmlurl: 'http://www.scorespro.com/rss2/live-soccer.xml',
            xmlUrl: 'http://www.scorespro.com/rss2/live-soccer.xml'
          }
        });
        footballService.onItem({
          description: '(BRA-QF) Novorizontino vs Palmeiras: 1-2 - Halftime',
          meta: {
            xmlurl: 'http://www.scorespro.com/rss2/live-soccer.xml',
            xmlUrl: 'http://www.scorespro.com/rss2/live-soccer.xml'
          }
        });
        footballService.notify.should.not.be.called();
        footballService.notify.should.have.callCount(0);
      });
      it('should notifiy subscribers according to their preferences', function() {
        footballService.notify = function(m) {
          should.exist(m);
          m.message.should.equal('notify');
          m.data.notificationMessage('Kick Off - FC Bayern 0 : 0 Borussia Dortmund');
          m.data.subscriptions.should.containEql({id: 0});
        }
        footballService.onItem({
          description: '(GER-BL) FC Bayern vs Borussia Dortmund: 0-0 - Kick Off',
          meta: {
            xmlurl: 'http://www.scorespro.com/rss2/live-soccer.xml',
            xmlUrl: 'http://www.scorespro.com/rss2/live-soccer.xml'
          }
        });
        footballService.notify = function(m) {
          should.exist(m);
          m.message.should.equal('notify');
          m.data.notificationMessage('Anstoss - Freiburg 0 : 0 Vfl Wolfsburg');
          m.data.subscriptions.should.containEql({id: 2});
        }
        footballService.onItem({
          description: '(GER-BL) Freiburg vs Vfl Wolfsburg: 0-0 - Kick Off',
          meta: {
            xmlurl: 'http://www.scorespro.com/rss2/live-soccer.xml',
            xmlUrl: 'http://www.scorespro.com/rss2/live-soccer.xml'
          }
        });
        footballService.notify = function(m) {
          should.exist(m);
          m.message.should.equal('notify');
          m.data.notificationMessage('Tor für Borussia Dortmund - FC Bayern 0 : 1 Borussia Dortmund');
          m.data.subscriptions.should.containEql({id: 0});
        }
        footballService.onItem({
          description: '(GER-BL) FC Bayern vs Borussia Dortmund: 0-1 - Goal for Borussia Dortmund',
          meta: {
            xmlurl: 'http://www.scorespro.com/rss2/live-soccer.xml',
            xmlUrl: 'http://www.scorespro.com/rss2/live-soccer.xml'
          }
        });
        footballService.notify = function(m) {
          should.exist(m);
          m.message.should.equal('notify');
          m.data.notificationMessage('Halbzeit - FC Bayern 0 : 1 Borussia Dortmund');
          m.data.subscriptions.should.containEql({id: 0});
        }
        footballService.onItem({
          description: '(GER-BL) FC Bayern vs Borussia Dortmund: 0-1 - Halftime',
          meta: {
            xmlurl: 'http://www.scorespro.com/rss2/live-soccer.xml',
            xmlUrl: 'http://www.scorespro.com/rss2/live-soccer.xml'
          }
        });
        footballService.notify = function(m) {
          should.exist(m);
          m.message.should.equal('notify');
          m.data.notificationMessage('Halbzeit - Freiburg 0 : 0 Vfl Wolfsburg');
          m.data.subscriptions.should.containEql({id: 2});
        }
        footballService.onItem({
          description: '(GER-BL) Freiburg vs Vfl Wolfsburg: 0-0 - Halftime',
          meta: {
            xmlurl: 'http://www.scorespro.com/rss2/live-soccer.xml',
            xmlUrl: 'http://www.scorespro.com/rss2/live-soccer.xml'
          }
        });
        footballService.notify = function(m) {
          should.exist(m);
          m.message.should.equal('notify');
          m.data.notificationMessage('Beginn der 2. Halbzeit - FC Bayern 0 : 1 Borussia Dortmund');
          m.data.subscriptions.should.containEql({id: 0});
        }
        footballService.onItem({
          description: '(GER-BL) FC Bayern vs Borussia Dortmund: 0-1 - 2nd Half Started',
          meta: {
            xmlurl: 'http://www.scorespro.com/rss2/live-soccer.xml',
            xmlUrl: 'http://www.scorespro.com/rss2/live-soccer.xml'
          }
        });
        footballService.notify = function(m) {
          should.exist(m);
          m.message.should.equal('notify');
          m.data.notificationMessage('Beginn der 2. Halbzeit - Freiburg 0 : 0 Vfl Wolfsburg');
          m.data.subscriptions.should.containEql({id: 2});
        }
        footballService.onItem({
          description: '(GER-BL) Freiburg vs Vfl Wolfsburg: 0-0 - 2nd Half Started',
          meta: {
            xmlurl: 'http://www.scorespro.com/rss2/live-soccer.xml',
            xmlUrl: 'http://www.scorespro.com/rss2/live-soccer.xml'
          }
        });
        footballService.notify = function(m) {
          should.exist(m);
          m.message.should.equal('notify');
          m.data.notificationMessage('Tor für Vfl Wolfsburg - Freiburg 0 : 1 Vfl Wolfsburg');
          m.data.subscriptions.should.containEql({id: 3});
        }
        footballService.onItem({
          description: '(GER-BL) Freiburg vs Vfl Wolfsburg: 0-1 - Goal for Vfl Wolfsburg',
          meta: {
            xmlurl: 'http://www.scorespro.com/rss2/live-soccer.xml',
            xmlUrl: 'http://www.scorespro.com/rss2/live-soccer.xml'
          }
        });
        footballService.notify = function(m) {
          should.exist(m);
          m.message.should.equal('notify');
          m.data.notificationMessage('Spielende - FC Bayern 0 : 1 Borussia Dortmund');
          m.data.subscriptions.should.containEql({id: 0});
          m.data.subscriptions.should.containEql({id: 1});
        }
        footballService.onItem({
          description: '(GER-BL) FC Bayern vs Borussia Dortmund: 0-1 - Match Finished',
          meta: {
            xmlurl: 'http://www.scorespro.com/rss2/live-soccer.xml',
            xmlUrl: 'http://www.scorespro.com/rss2/live-soccer.xml'
          }
        });
        footballService.notify = function(m) {
          should.exist(m);
          m.message.should.equal('notify');
          m.data.notificationMessage('Spielende - Freiburg 0 : 1 Vfl Wolfsburg');
          m.data.subscriptions.should.containEql({id: 2});
          m.data.subscriptions.should.containEql({id: 3});
        }
        footballService.onItem({
          description: '(GER-BL) Freiburg vs Vfl Wolfsburg: 0-1 - Match Finished',
          meta: {
            xmlurl: 'http://www.scorespro.com/rss2/live-soccer.xml',
            xmlUrl: 'http://www.scorespro.com/rss2/live-soccer.xml'
          }
        });
      });
    })

  });

});
