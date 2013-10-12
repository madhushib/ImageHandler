/*
 * Madhushib
 */
/** **************** Options Class ******************** */
const Cc = Components.classes;
const Ci = Components.interfaces;
Components.utils.import("resource://imagehandler/common.js");
Components.utils.import("resource://imagehandler/settings.js");

/**
 * JavaScript for Options windonws
 *
 * @namespace ImageHandlerChrome
 * @class ImageHandlerChrome.Options
 * @constructor
 */
ImageHandlerChrome.Options = {
    onLoad : function() {
        // populate windows title for "remove text"
       var removeTextMenulist = document.getElementById("removeTextMenulist");
        var windowTitle = window.opener.document.title;
        var removeTexts = this._splitTitle(windowTitle);
        for ( var i = 0; i < removeTexts.length; i++) {
            var item = removeTextMenulist.appendItem(removeTexts[i]);
            item.setAttribute("crop", "none");
        }
        // init RemoveText Elements
        this.enableOrDisableRemoveTextElements(ImageHandler.Settings.isCreatedFolderByTitle());

        //Disalbe download manager feature since bug https://bugzilla.mozilla.org/show_bug.cgi?id=844566
        if(ImageHandler.Settings.hasWinTaskbar()){
            var downloadManagerPrefCheckbox = document.getElementById("downloadManagerPrefCheckbox");
            downloadManagerPrefCheckbox.disabled = true;
        }
    },

    /**
     * Split the window title to show accordingly
     * @param {} windowTitle
     * @return {}
     */
    _splitTitle : function(windowTitle) {
        var results = new Array();
        if (windowTitle != null && windowTitle != "") {
            var headTexts = new Array();
            var tailTexts = new Array();
            var separatorRE = /\t|-|_|\|/g;
            var result = separatorRE.exec(windowTitle);
            while (result != null) {
                var hText = windowTitle.substring(0, separatorRE.lastIndex);
               headTexts.push(hText);
                var tText = windowTitle.substring(result.index);
                tailTexts.push(tText);
                result = separatorRE.exec(windowTitle);
            }
            results = headTexts.concat(tailTexts);
        }
        return results;
    },

    enableOrDisableRemoveTextElements : function(enable) {
        var showSubfolderNameConfirmationPopupCheckbox = document
                .getElementById("showSubfolderNameConfirmationPopupCheckbox");
        var removeTextMenulist = document.getElementById("removeTextMenulist");
        var removeTextTB = document.getElementById("removeTextTB");
        var removeTextBtn = document.getElementById("removeTextBtn");

        if (enable) {
            showSubfolderNameConfirmationPopupCheckbox.disabled = false;
            removeTextMenulist.disabled = false;
            removeTextTB.disabled = false;
            removeTextBtn.disabled = false;
        } else {
            showSubfolderNameConfirmationPopupCheckbox.disabled = true;
            showSubfolderNameConfirmationPopupCheckbox.checked = false;
            removeTextMenulist.disabled = true;
            removeTextTB.disabled = true;
            removeTextBtn.disabled = true;
        }
    },

    /**
     * restore all the defoult options back
     */
    restoreAll : function() {
        var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
        var versionChecker = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
                       .getService(Components.interfaces.nsIVersionComparator);
        var isUnderV6 = versionChecker.compare(appInfo.version, "6") < 0;
        // restore
        var preferences = document.getElementsByTagName("preference");
        for ( var i = 0; i < preferences.length; i++) {
            ImageHandler.Logger.info("preference:" + preferences[i].id + ", hasUserValue = "
                    + preferences[i].hasUserValue);
            if(!isUnderV6 || preferences[i].hasUserValue){
                preferences[i].reset(); // preference.reset()
            }
        }
        // Restore RemoveText Elements
        this.enableOrDisableRemoveTextElements(true);
    },
/**
 * Set all buttons as changed
 */
    onDialogAccept : function() {
        ImageHandler.Logger.debug("Installing button...");
        var buttonNames = [ "ipbutton-simple", "ipbutton-all", "ipbuttons" ];
        buttonNames.forEach(function(buttonName) {
            var buttonId = buttonName + "-toolbar";
            var isShow = ImageHandler.Settings.isShowOnToolbar(buttonName);
            ImageHandlerChrome.installButton("nav-bar", buttonId, isShow);
            ImageHandler.Logger.debug("Installed button: " + buttonId + " to toolbar, isShow=" + isShow);
        });
    },

    /**
     * apply changes if user prefer so
     */
    onDialogClose : function() {
        var prefWindow = document.getElementById("imagehandler-prefs");
        ImageHandler.Logger.debug("onDialogClose, prefWindow=" + prefWindow);
        if(prefWindow.instantApply){
            ImageHandler.Logger.debug("Call onDialogAccept() when instantApply is on.");
            this.onDialogAccept();
        }
    }
}
