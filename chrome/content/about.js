/** **************** ImageInfo Object Class ******************** */
Components.utils.import("resource://imagehandler/common.js");

ImageHandlerChrome.BrowserUtils = {
   
    loadHomepage: function(aEvent) {
        window.close();
        openUILinkIn(aEvent.target.getAttribute("homepageURL"), "tab");
    }
}
