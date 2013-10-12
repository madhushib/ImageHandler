/****************** Settings Object Class *********************/
var EXPORTED_SYMBOLS = [];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://imagehandler/common.js");

/**
 * Provides the preference utilities and extensions used by the ImageHandler
 * @namespace ImageHandler
 * @class ImageHandler.Settings
 */
ImageHandler.Settings =  {

    _prefs : Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch(
                "extensions.imagehandler."),

    getThumbnailType: function(){
        return this._prefs.getCharPref("displayrule.thumbnailType");
    },

    setThumbnailType: function(tnType){
        return this._prefs.setCharPref("displayrule.thumbnailType", tnType);
    },

    isShowImageSize: function(){
        return this._prefs.getBoolPref("displayrule.showImageSize");
    },

    setShowImageSize: function(isShowImageSize){
        return this._prefs.setBoolPref("displayrule.showImageSize", isShowImageSize);
    },

    isShowImageName: function(){
        return this._prefs.getBoolPref("displayrule.showImageName");
    },

    setShowImageName: function(isShowImageName){
        return this._prefs.setBoolPref("displayrule.showImageName", isShowImageName);
    },

    getMinWidth: function(){
        return this._prefs.getIntPref("filter.minWidth");
    },

    setMinWidth: function(minWidth){
        return this._prefs.setIntPref("filter.minWidth", minWidth);
    },

    getMinHeight: function(){
        return this._prefs.getIntPref("filter.minHeight");
    },

    setMinHeight: function(minHeight){
        return this._prefs.setIntPref("filter.minHeight", minHeight);
    },

    getMinSize: function(){
        return this._prefs.getIntPref("filter.minSize");
    },

    setMinSize: function(minSize){
        return this._prefs.setIntPref("filter.minSize", minSize);
    },

    isSkipImageTypeBMP: function(){
        return this._prefs.getBoolPref("filter.skipImageTypes.bmp");
    },

    setSkipImageTypeBMP: function(isSkip){
        return this._prefs.setBoolPref("filter.skipImageTypes.bmp", isSkip);
    },

    isSkipImageTypeJPG: function(){
        return this._prefs.getBoolPref("filter.skipImageTypes.jpg");
    },

    setSkipImageTypeJPG: function(isSkip){
        return this._prefs.setBoolPref("filter.skipImageTypes.jpg", isSkip);
    },

    isSkipImageTypePNG: function(){
        return this._prefs.getBoolPref("filter.skipImageTypes.png");
    },

    setSkipImageTypePNG: function(isSkip){
        return this._prefs.setBoolPref("filter.skipImageTypes.png", isSkip);
    },

    isSkipImageTypeGIF: function(){
        return this._prefs.getBoolPref("filter.skipImageTypes.gif");
    },

    setSkipImageTypeGIF: function(isSkip){
        return this._prefs.setBoolPref("filter.skipImageTypes.gif", isSkip);
    },

    //get list of folders of images to be saved from preference and return a list of them
    getSavedFolderPaths: function(){

        var pathList = this.getUnicodeChar(this._prefs, "savedFolderPathList");
        var paths = new Array();
        if(pathList.trim() != ""){
           paths = pathList.split("\n");
        }

        return paths;
    },

    addSavedFolderPath: function(path){
        var MAX_PATH_COUNT = 10;
        var paths = this.getSavedFolderPaths();

        var pathList = path;
        var pathCount = 1;
        for(var i=0; i< paths.length; i++){
            if(paths[i] != path){ // filter duplicate path
                pathList = pathList + "\n" + paths[i];
                pathCount++
            }
            if(pathCount >= MAX_PATH_COUNT){ //quit loop when reach the max limit
                break;
            }
        }

        this.setUnicodeChar(this._prefs, "savedFolderPathList", pathList);
    },

    clearSavedFolderPaths: function(){
        this.setUnicodeChar(this._prefs, "savedFolderPathList", "");
    },

    isCreatedFolderByTitle: function(){
        return this._prefs.getBoolPref("createdFolderByTitle");
    },

    isShowSubfolderNameConfirmationPopup: function(){
        return this._prefs.getBoolPref("showSubfolderNameConfirmationPopup");
    },

    isRenameImageBySequenceNum: function(){
        return this._prefs.getBoolPref("renameImageBySequenceNum");
    },

    isOpenExplorerAfterSaved: function(){
        return this._prefs.getBoolPref("openExplorerAfterSaved");
    },

    isOpenDownloadManagerAfterSaved: function(){
        return this._prefs.getBoolPref("openDownloadManagerAfterSaved");
    },

    isCloseImageHandlerAfterSaved: function(){
        return this._prefs.getBoolPref("closeImageHandlerAfterSaved");
    },

    isCloseBrowserTabAfterSaved: function(){
        return this._prefs.getBoolPref("closeBrowserTabAfterSaved");
    },

    getRemoveTextFromTitle: function(){

        var text = this.getUnicodeChar(this._prefs, "removeTextFromTitle");
        var textLines = text.split("\n");

        var results = new Array();
        for(var i=0; i<textLines.length; i++){
            if (textLines[i] != null && textLines[i].trim() != "") {
                results.push(textLines[i]);
            }
        }

        //sort by length desc
        results = results.sort(
             function(a,b){
                   return b.length - a.length;
             }
        );

        return results;
    },

    isDoubleclickImageToSaveEnabled: function(){
        return this._prefs.getBoolPref("collector.doubleclickImageToSave.enable");
    },

    isDragImageToSaveEnabled: function(){
        return this._prefs.getBoolPref("collector.dragImageToSave.enable");
    },

    isShowOnToolbar: function(button){
        var prefName = "ui." + button + ".toolbar.show";
        return this._prefs.getBoolPref(prefName);
    },

    isShowOnContextMenu: function(button){
	    var prefName = "ui." + button + ".contextmenu.show";
        return this._prefs.getBoolPref(prefName);
    },

    /**
     * Get a unicode char value from preference system for the given prefName
     * @method getUnicodeChar
     * @param {nsIPrefBranch} prefs the preference system branch object.
     * @param {String} prefName the preference name to get preference value.
     * @return {String} the preference value for the given prefName
     */
    getUnicodeChar: function(prefs, prefName){
        return prefs.getComplexValue(prefName, Ci.nsISupportsString).data;
    },

    /**
     * Set a unicode char value to preference system for the given prefName
     * @method setUnicodeChar
     * @param {nsIPrefBranch} prefs the preference system branch object.
     * @param {String} prefName the preference name.
     * @param {String} prefValue the preference value.
     */
    setUnicodeChar: function(prefs, prefName, prefValue){
        var supportsString = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
        supportsString.data = prefValue;
        prefs.setComplexValue(prefName, Ci.nsISupportsString, supportsString);
    },

    /**
     * Check the OS have window taskbar
     */
    hasWinTaskbar: function(){
        var winTaskbar = Cc["@mozilla.org/windows-taskbar;1"];
        var winTaskbarSvc = (winTaskbar? winTaskbar.getService(Ci.nsIWinTaskbar) : null);
        return (winTaskbarSvc && winTaskbarSvc.available);
    }
};
