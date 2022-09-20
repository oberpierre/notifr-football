var objectNormalizer = require('../index.js');
var assert = require('assert');

describe('ObjectNormalizer', function() {
  describe('#getElement()', function() {
    it('should return undefined if field doesn\'t exist', function() {
      var obj = {
        title: 'This is a title',
        description: 'This is a simple test'
      };
      var arr = [0, 1, 2];

      assert.equal(undefined, objectNormalizer.getElement('nonexistent', obj));
      assert.equal(undefined, objectNormalizer.getElement('', obj));
      assert.equal(undefined, objectNormalizer.getElement(undefined, obj));
      assert.equal(undefined, objectNormalizer.getElement(null, obj));
      assert.equal(undefined, objectNormalizer.getElement('TITLE', obj));
      assert.equal(undefined, objectNormalizer.getElement({title: 'title'}, obj));
      assert.equal(undefined, objectNormalizer.getElement('Title', obj));
      assert.equal(undefined, objectNormalizer.getElement(0, obj));
      assert.equal(undefined, objectNormalizer.getElement('0', obj));
      assert.equal(undefined, objectNormalizer.getElement('.title', obj));
      assert.equal(undefined, objectNormalizer.getElement('..title', obj));

      assert.equal(undefined, objectNormalizer.getElement(-1, arr));
      assert.equal(undefined, objectNormalizer.getElement('4', arr));
      assert.equal(undefined, objectNormalizer.getElement('title', arr));
    });

    it('should be able to return specified existing array elements', function() {
      var arr = [0, 1, 2];

      assert.equal(0, objectNormalizer.getElement(0, arr));
      assert.equal(1, objectNormalizer.getElement(1, arr));
      assert.equal(2, objectNormalizer.getElement(2, arr));
    });

    it('should return the value of the specified existing field', function() {
      var obj = {
        title: 'This is a title',
        description: 'This is a simple test',
        1: 999999,
        _META: {
          ref: 'Reference',
          link: 'http://'
        }
      };
      assert.equal('This is a title', objectNormalizer.getElement('title', obj));
      assert.equal('This is a simple test', objectNormalizer.getElement('description', obj));
      assert.equal(999999, objectNormalizer.getElement('1', obj));
      assert.deepStrictEqual({ref: 'Reference', link: 'http://'}, objectNormalizer.getElement('_META', obj));
    });

    it('should be able to find elements over mutliple levels', function() {
      var obj = {
        address: {
          city: 'Testcity',
          plz: 12345,
          plzArray: [1, 2, 3, 4, 5]
        },
        arr: [0, 1, 2]
      };

      assert.equal('Testcity', objectNormalizer.getElement('address.city', obj));
      assert.equal(12345, objectNormalizer.getElement('address.plz', obj));

      assert.deepStrictEqual([1, 2, 3, 4, 5], objectNormalizer.getElement('address.plzArray', obj));
      assert.equal(1, objectNormalizer.getElement('address.plzArray.0', obj));
      assert.equal(5, objectNormalizer.getElement('address.plzArray.4', obj));

      assert.deepStrictEqual([0, 1, 2], objectNormalizer.getElement('arr', obj));
      assert.equal(0, objectNormalizer.getElement('arr.0', obj));
      assert.equal(2, objectNormalizer.getElement('arr.2', obj));
    });
  });

  describe('#normalize()', function() {
    it('should return an object', function() {
      var obj = {
        address: {
          city: 'Testcity',
          plz: 12345,
          plzArray: [1, 2, 3, 4, 5]
        },
        arr: [0, 1, 2]
      };

      var test1 = objectNormalizer.normalize(undefined, undefined);
      var test2 = objectNormalizer.normalize(undefined, obj);
      var test3 = objectNormalizer.normalize({}, obj);
      assert.deepStrictEqual({}, test1);
      assert.deepStrictEqual({}, test2);
      assert.deepStrictEqual({}, test3);
      assert.equal('object', typeof(test1));
      assert.equal('object', typeof(test2));
      assert.equal('object', typeof(test3));
    });

    it('should contain all specified fields and no more', function() {
      var test1 = {
        title: '',
        description: '',
        test: '',
      }
      var expected1 = {
        title: undefined,
        description: undefined,
        test: undefined
      }
      assert.deepStrictEqual(expected1, objectNormalizer.normalize(test1, undefined))

      var test2 = {
        title: 'title',
        description: 'description',
        plz: 'address.plz',
        city: 'address.city',
        address: 'address'
      }
      var expected2 = {
        title: undefined,
        description: undefined,
        plz: undefined,
        city: undefined,
        address: undefined
      }

      assert.deepStrictEqual(expected2, objectNormalizer.normalize(test2, undefined));

      var test3 = {};
      for (var i = 0;i < 100;i++) {
        test3['key'+i] = (i % 2 == 0 ? 'value'+i : i);
      }
      result3 = objectNormalizer.normalize(test3, undefined);
      var k = 0;
      for (var key in result3) {
        k++;
      }
      assert.equal(100, k);
    });

    it('should parse the information correctly', function() {
      var obj = {
        address: {
          city: 'Testcity',
          plz: 12345
        },
        title: 'This is a title',
        description: 'Description'
      };

      var form = {
        title: 'title',
        description: 'description',
        plz: 'address.plz',
        city: 'address.city',
        address: 'address'
      };

      assert.deepStrictEqual({
        title: 'This is a title',
        description: 'Description',
        plz: 12345,
        city: 'Testcity',
        address: {
          city: 'Testcity',
          plz: 12345
        }
      }, objectNormalizer.normalize(form, obj));

      var form2 = {
        'a': {
          'b': 'title',
          'c': 'description'
        },
        'd': {
          'e': 'address.city',
          'f': 'address.plz'
        }
      };
      
      assert.deepStrictEqual({
        a: {
          b: 'This is a title',
          c: 'Description'
        },
        d: {
          e: 'Testcity',
          f: 12345
        }
      }, objectNormalizer.normalize(form2, obj));
    });
  });
});
