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

    
}
