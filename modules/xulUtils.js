/** **************** FileUtils Object Class ******************** */
var EXPORTED_SYMBOLS = [];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://imagehandler/common.js");

/**
 * Provides XUL utilities and extensions used by the ImageHandler
 *
 * @namespace ImageHandler
 * @class ImageHandler.XulUtils
 */
ImageHandler.XulUtils = {
        
    hasClass: function(element, className) {
        var elementClassName = element.className;
        return (elementClassName.length > 0 && (elementClassName == className ||
          new RegExp("(^|\\s)" + className + "(\\s|$)").test(elementClassName)));
    },

    addClass: function(element, className) {
        if (!this.hasClass(element, className)) {
            element.className += (element.className ? ' ' : '') + className;
        }
    },
    
    removeClass: function(element, className) {
        element.className = element.className.replace(
          new RegExp("(^|\\s+)" + className + "(\\s+|$)"), ' ');
    }
};
