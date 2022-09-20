/**
 * @author Pierre Obermaier <obermpie@students.zhaw.ch>
 * @class
 * @classdesc Offers static functions to normalize objects.
 */
class ObjectNormalizer {

  /**
   * Extracts an element from the object.
   * @function getElement
   * @memberof ObjectNormalizer
   * @static
   * @param {string} item The item that should be extracted from the object referenced from the root of the obj.
   * @param {Object} obj The object containing the element.
   * @returns {*} The element if it could be found with its original type or undefined.
   */
  static getElement(item, obj) {
    if (typeof(item) === 'number') {
      item += '';
    }
    else if (typeof(item) !== 'string')
      return undefined;
    if (obj === undefined || obj === null)
      return undefined;
    var ix = item.indexOf('.');
    if (ix > -1) {
      return this.getElement(item.substring(ix+1), obj[item.substring(0, ix)]);
    }
    return obj[item];
  }

  /**
   * Creates a new object with the keys of form and the extracted values from obj.
   * @function normalize
   * @memberof ObjectNormalizer
   * @static
   * @param {Object} form The form with the desired keys and corresponding values of obj.
   * @param {Object} obj The object containing the elements you want to extract.
   * @returns {Object} The resulting object with the each found element or undefined if an element could not be found.
   */
  static normalize(form, obj) {
    var _new = {};
    for (var key in form) {
      if (typeof(form[key]) === 'object') {
        _new[key] = this.normalize(form[key], obj);
      }
      else {
        _new[key] = this.getElement(form[key], obj);
      }
    }
    return _new;
  }

}

module.exports = ObjectNormalizer;
