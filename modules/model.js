/** **************** ImageInfo Object Class ******************** */
var EXPORTED_SYMBOLS = [];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://imagehandler/common.js");

/**
 * Provides the ImageInfo class used by the ImageHandler
 *
 * @namespace ImageHandler
 * @class ImageHandler.ImageInfo
 * @constructor
 * @param {Number}
 *            UUID
 * @param {HTMLElement}
 *            image element
 * @param {Number}
 *            the top of image (absolute position)     
 */
ImageHandler.ImageInfo = function(id, image, imageTop) {

    this.id = id;
    this.imageSrc = image;
    this.url = image.src;
    this.height = image.height;
    this.width = image.width;
    this.top = imageTop;
    this.fileSize = 0;
    this.isCached = true;
    this.loadFileSizeFromCacheCompleted = false;
    this.properyChangeListener = null;

    this.nameFromURL = this.url.substring(this.url.lastIndexOf('/') + 1, this.url.length);

    this.fileExt = null; 
    this.setFileName(this.nameFromURL);

    ImageHandler.Logger.info("Created ImageInfo[id=" + this.id + ", name=" + this.fileName + ", width=" + this.width
            + ", height=" + this.height + ",URL=" + this.url  + ",top=" + this.top + "]");
};

ImageHandler.ImageInfo.prototype = {

    /**
     * Register the given listener for image change
     * The given listener must have a onPropertyChange(ImageInfo) method.
     */
    registerChangeListener : function(changeListener) {
        this.properyChangeListener = changeListener;
    },

    setFileSize : function(newFileSize) {
        this.fileSize = newFileSize;

        // fire update event
        if (this.properyChangeListener) {
            this.properyChangeListener.onPropertyChange(this);
        }
    },

    setFileName : function(newFileName) {
        var reg = /(.+)\.(\w*)/;
        var result = reg.exec(newFileName);
        if (result != null) {
            this.fileName = result[1];
            this.fileExt = result[2];
        } else {
            this.fileName = newFileName;
        }

        // fire update event
        if (this.properyChangeListener) {
            this.properyChangeListener.onPropertyChange(this);
        }
    },
    
    setFileExt : function(newFileExt) {
        this.fileExt = newFileExt;

        // fire update event
        if (this.properyChangeListener) {
            this.properyChangeListener.onPropertyChange(this);
        }
    },
    
    getFileNameExt : function() {
        return this.fileName + (this.fileExt == null? "": ("." + this.fileExt));
    },

    toString : function() {
        return "Image:[id=" + this.id + ", name=" + this.fileName + ", ext=" + this.fileExt + "]";
    }
};