/** **************** DownloadSession Class ******************** */
var EXPORTED_SYMBOLS = [];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://imagehandler/common.js");
Cu.import("resource://imagehandler/sequence.js");
Cu.import("resource://imagehandler/settings.js");
Cu.import("resource://imagehandler/fileUtils.js");
Cu.import("resource://gre/modules/PopupNotifications.jsm");

/**
 * DownloadSession class is used to download multiple files
 *
 * @namespace ImageHandler
 * @class ImageHandler.DownloadSession
 * @constructor
 */
ImageHandler.DownloadSession = function(images, destDir, privacyInfo, oldDownloadProgressListener,
        newDownloadProgressListener, postSavedListeners, stringsBundle, batchMode) {

    this.images = images;
    this.destDir = destDir;
    this.privacyContext = privacyInfo.privacyContext;
    this.inPrivateBrowsingMode = privacyInfo.inPrivateBrowsing;

    this.oldDownloadProgressListener = oldDownloadProgressListener;
    this.newDownloadProgressListener = newDownloadProgressListener;
    this.postSavedListeners = postSavedListeners;
    this.stringsBundle = stringsBundle;



    this.ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    this.mimeService = Cc["@mozilla.org/mime;1"].getService(Ci.nsIMIMEService);
    this.downloadManager = Cc["@mozilla.org/download-manager;1"].getService(Ci.nsIDownloadManager);

    //For Win7, Firefox have a bug https://bugzilla.mozilla.org/show_bug.cgi?id=844566
    //The nsITaskbarProgress.setProgressState() throw error when add multiple download items, so skip DownloadManager for win7
    if(ImageHandler.Settings.hasWinTaskbar()){
        this.downloadManager = null;
    }

    this.batchMode = batchMode;

    ImageHandler.Logger.info("Created DownloadSession[images=" + this.images.length + ", destDir=" + this.destDir.path
            + ", inPrivateBrowsingMode=" + this.inPrivateBrowsingMode + ", downloadManager=" + this.downloadManager + "]");
};

ImageHandler.DownloadSession.prototype = {

    /**
     * save images to local
     *
     * @method saveImages
     */
    saveImages : function() {

        var images = this.images;

        // Auto rename
        if (ImageHandler.Settings.isRenameImageBySequenceNum() && this.batchMode) {
            this._renameBySequence(images);
        }

        // Register progress listener
        if(this.downloadManager){
            if (this.oldDownloadProgressListener != null) {
                this.downloadManager.removeListener(this.oldDownloadProgressListener);
            }
            if (this.newDownloadProgressListener != null) {
                this.downloadManager.addListener(this.newDownloadProgressListener);
            }
        }

        this._preSaveImages(this.destDir, images, this.stringsBundle);

        // Handle each file
        var fileNames = new Array();
        for ( var i = 0; i < images.length; i++) {
            var img = images[i];
            var fileNameExt = img.fileName + "." + (img.fileExt == null? "jpg" : img.fileExt);
            var file = ImageHandler.FileUtils.createUniqueFile(fileNameExt, this.destDir, fileNames);
            try {
                this._saveImageToFile(img.url, file, this.downloadManager);
            } catch (ex) {
                ImageHandler.Logger.error("Cannot save image: " + img, ex);
            }
        }

        this._postSaveImages(this.destDir, images, this.postSavedListeners, this.stringsBundle);
    },

    _preSaveImages : function(savedFolder, images, stringsBundle) {
    },

    _postSaveImages : function(savedFolder, images, postSavedListeners, stringsBundle) {

        if (postSavedListeners) {
            postSavedListeners.forEach(function(listener) {
                ImageHandler.Logger.debug("Invoke PostSavedListener: " + listener);
                if (listener) {
                    try {
                        listener.afterSavedImages(savedFolder, images);
                    } catch (ex) {
                        ImageHandler.Logger.error("Occured Error " + ex + " when execute PostSaveImage Listener: "
                                + listener);
                    }
                }
            });
        }
    },

    _renameBySequence : function(images) {
        var maxDigits = images.length.toString().length;
        var seq = new ImageHandler.Sequence(0, maxDigits);

        for ( var i = 0; i < images.length; i++) {
            var img = images[i];
            img.fileName = seq.next();
        }
    },

    /**
     * save image to local
     *
     * @method _saveImageToFile
     */
    _saveImageToFile : function(fromURL, toFile, downloadManager) {

        // Create URI from which we want to download file
        var fromURI = this.ioService.newURI(fromURL, null, null);

        // create cacheKey
        var cacheKey = Cc['@mozilla.org/supports-string;1'].createInstance(Ci.nsISupportsString);
        cacheKey.data = fromURL;

        // Set to where we want to save downloaded file
        var toURI = this.ioService.newFileURI(toFile);

        // Set up correct MIME type
        var mime;
        try {
            var type = this.mimeService.getTypeFromURI(fromURI);
            mime = this.mimeService.getFromTypeAndExtension(type, "");
        } catch (e) {
            ImageHandler.Logger.info("cannot get mine type, e = " + e);
        }

        // Observer for download
        var nsIWBP = Ci.nsIWebBrowserPersist;
        var persist = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].createInstance(nsIWBP);
        persist.persistFlags = nsIWBP.PERSIST_FLAGS_REPLACE_EXISTING_FILES | nsIWBP.PERSIST_FLAGS_FROM_CACHE
                | nsIWBP.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;

        // Start download
        if (downloadManager) {
            var dl = downloadManager.addDownload(downloadManager.DOWNLOAD_TYPE_DOWNLOAD, fromURI, toURI,
                    toFile.leafName, mime, Math.round(Date.now() * 1000), null, persist, this.inPrivateBrowsingMode);
            persist.progressListener = dl.QueryInterface(Ci.nsIWebProgressListener);
            // persist.progressListener = dl;
        } else {
            persist.progressListener = this.newDownloadProgressListener;
        }

        persist.saveURI(fromURI, cacheKey, null, null, null, toURI, this.privacyContext);
    }
};
