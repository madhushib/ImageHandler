var EXPORTED_SYMBOLS = [];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://imagehandler/common.js");

/**
 * Left-Pads the sequence number so that at it contains least "digits" digits.
 * @param {Object} start
 *                 the sequence start at
 * @param {Number} digits digits Number of digits the results must contain at least
 */
ImageHandler.Sequence = function(start, digits) {
    this.nextNum = start;
    this.digits = digits;
};

ImageHandler.Sequence.prototype = {
    
     next: function(){
        this.nextNum = this.nextNum + 1;
        
        //left pad
        var result = this.nextNum.toString();
        for (var i = result.length; i < this.digits; i++) {
            result = '0' + result;
        }
        
        return result;
     }
}