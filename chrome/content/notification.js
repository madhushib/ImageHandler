/*
 * madhushib
 */
Components.utils.import("resource://imagehandler/common.js");
Components.utils.import("resource://imagehandler/fileUtils.js");
Components.utils.import("resource://gre/modules/PopupNotifications.jsm");

/**
 * Notification class
 * Handle all notifications 
 * @namespace Notification
 * @class ImageHandlerChrome.Notification
 * @constructor
 */

/**
 * Notify on the saved folder path
 * @param {} title
 * @param {} savedFolderPath
 * @param {} browser
 * @param {} popupNotificationsSvc
 */
ImageHandlerChrome.Notification = function(title, savedFolderPath, browser, popupNotificationsSvc) {
    this.title = title;
    this.savedFolderPath = savedFolderPath;
    this.browser = browser;
    this.popupNotificationsSvc = popupNotificationsSvc;
    if (!this.popupNotificationsSvc) {
        this.popupNotificationsSvc = PopupNotifications;
    }

};

ImageHandlerChrome.Notification.prototype = {
    show : function() {
        var fileUtils = ImageHandler.FileUtils;
        var alertListener = {
            observe : function(subject, topic, data) {
                if (topic == "alertclickcallback") {
                    var dir = fileUtils.toDirectory(data);
                    fileUtils.revealDirectory(dir);
                }
            }
        };

        try {
            var alertsService = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
            alertsService.showAlertNotification("chrome://imagehandler/skin/img-handler_32.png", this.title,
                    this.savedFolderPath, true, this.savedFolderPath, alertListener, "ImageHandlerAlert");
            //abcefg.throwEx();
        } catch (ex) {
            ImageHandler.Logger.error("Occured Error " + ex);
            var filePath = this.savedFolderPath;

            var openAction = function() {
                var dir = fileUtils.toDirectory(filePath);
                fileUtils.revealDirectory(dir);
            };

            setTimeout(function() {
                notification.remove();
            }, 1500); // Time in seconds to disappear the door-hanger popup.
        }
    }
};
