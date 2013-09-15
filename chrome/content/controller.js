/** **************** Controller Class ******************** */
const Cc = Components.classes;
const Ci = Components.interfaces;
Components.utils.import("resource://imagehandler/common.js");
Components.utils.import("resource://imagehandler/hashMap.js");
Components.utils.import("resource://imagehandler/fileUtils.js");
Components.utils.import("resource://imagehandler/settings.js");
Components.utils.import("resource://imagehandler/xulUtils.js");
Components.utils.import("resource://imagehandler/model.js");
Components.utils.import("resource://imagehandler/filters.js");
Components.utils.import("resource://imagehandler/download.js");

/**
 * Provides the controller
 *
 * @namespace ImageHandlerChrome
 * @class ImageHandlerChrome.Controller
 * @constructor
 */
ImageHandlerChrome.Controller = {

    /**
     * callback function for loading pick window
     *
     * @method init
     */
    init : function() {
        // Get preferences
        this.settings = ImageHandler.Settings;

        this.rawImageList = window.arguments[0].imageList;
        this.browser = window.arguments[0].browser;
        this.popupNotifications = window.arguments[0].popupNotifications;

        var postSavedListenersFromArgument = window.arguments[0].listeners;

        /**
         * Register the given listener to extend the after image saving behavior
         * The given listener must have a afterSavedImages() method.
         */
        var postSavedListener = {
            afterSavedImages: function(savedFolder, images){
                //open Explorer after saved if need
                if (ImageHandler.Settings.isOpenExplorerAfterSaved()) {
                    ImageHandler.FileUtils.revealDirectory(savedFolder);
                }

                //open DownloadManager after saved if need
                if (ImageHandler.Settings.isOpenDownloadManagerAfterSaved() &&
                       !ImageHandler.Settings.hasWinTaskbar()) {
                    ImageHandlerChrome.Controller.showDownloadManagerUI();
                }

                //close ImageHandler dialog after saved if need
                if (ImageHandler.Settings.isCloseImageHandlerAfterSaved()) {
                    self.close();
                }
            }
        };

        this.postSavedListeners = [postSavedListener];
        this.postSavedListeners =  this.postSavedListeners.concat(postSavedListenersFromArgument);
        ImageHandler.Logger.debug("Argument listeners: " + postSavedListenersFromArgument.length);
        ImageHandler.Logger.debug("PostSavedListeners: " + this.postSavedListeners.length);

        this.imageList = this.rawImageList;
        this.selectedMap = new ImageHandler.HashMap();
        this.filter = null;
        this.progressListener = null;



        // init image grid
        var gridSize = window.innerWidth - 6;

        var thumbnailType = this.settings.getThumbnailType();
        var isShowImageSize = this.settings.isShowImageSize();
        var isShowImageName = this.settings.isShowImageName();
        this.imageGrid = new ImageHandlerChrome.ImageGrid("imageContainer", gridSize, thumbnailType, isShowImageSize,
                isShowImageName);

        // Store the resize flag for first open
        this.MIN_WINDOW_WIDTH = 772;
        this.isResizeToMinWidth = false;
    },

    /**
     * callback function for loading pick window
     *
     * @method loadPickWindow
     */
    loadPickWindow : function() {

        // init window title
        window.document.title = window.arguments[0].title;

        var isShowImageSize = this.settings.isShowImageSize();
        var isShowImageName = this.settings.isShowImageName();
        document.getElementById("showImageSizeMI").setAttribute("checked", isShowImageSize);
        document.getElementById("showImageNameMI").setAttribute("checked", isShowImageName);

        this._renderSavedFolderPathMenuList();

        this.doShowAll();

        // add event
        window.addEventListener("resize", function() {
            ImageHandlerChrome.Controller.onResize();
        }, true);
    },

    _renderSavedFolderPathMenuList : function() {

        var savedPathMenulist = document.getElementById("savedPathMenulist");

        // Remove all menu items except menu separator and "Clear all" menu items
        var endIndex = savedPathMenulist.itemCount - 3;
        for (var i = endIndex; i >=0; i--) {
            savedPathMenulist.removeItemAt(i);
        }
        savedPathMenulist.selectedIndex = -1;

        // Add menu items from settings
        var paths = this.settings.getSavedFolderPaths();
        for(var i=0; i< paths.length; i++){
           var item = savedPathMenulist.insertItemAt(i,paths[i]);
        }

        // select one
        if(paths.length > 0){
            savedPathMenulist.selectedIndex = 0;
        }else{
            savedPathMenulist.selectedIndex = -1;
        }

        //enable "Clear All" menu item only if have path
        var clearAllSavedPathsMenuItem = document.getElementById("clearAllSavedPathsMenuItem");
        clearAllSavedPathsMenuItem.disabled = (paths.length == 0);
    },

    _addSavedFolderPath : function(path) {

        this.settings.addSavedFolderPath(path);

        //update UI
        this._renderSavedFolderPathMenuList();
    },

    clearAllSavedPaths : function(path) {

        this.settings.clearSavedFolderPaths(path);

        //update UI
        this._renderSavedFolderPathMenuList();
    },

    /**
     * callback function for unloading pick window
     *
     * @method unloadPickWindow
     */
    unloadPickWindow : function() {

        // save saved folder
        this._addSavedFolderPath(document.getElementById("savedPathMenulist").value);

        // Remove progress listener from Download Manager if have
        var dm = Cc["@mozilla.org/download-manager;1"].getService(Ci.nsIDownloadManager);

        // unregister progress listener
        if (this.progressListener != null) {
            dm.removeListener(this.progressListener);
        }
    },

     onResize : function() {

        if(!this.isResizeToMinWidth){
            this.isResizeToMinWidth = true;
            var windowWidth = window.outerWidth;
            if (windowWidth < this.MIN_WINDOW_WIDTH) {
                window.sizeToContent();
                //window.resizeTo(this.MIN_WINDOW_WIDTH, window.outerHeight);
                ImageHandler.Logger.debug("ResizeToMinWidth: from " + windowWidth + " to " + window.outerWidth);
            }
        }

        this.refreshImageContainer();
     },

    /**
     * refresh image container
     *
     * @method refreshImageContainer
     */
    refreshImageContainer : function() {

        var imageContainer = document.getElementById("imageContainer");

        // clean old image grid
        while (imageContainer.hasChildNodes()) {
            imageContainer.removeChild(imageContainer.firstChild);
        }

        // render image grid
        var gridWidth = window.innerWidth - 6;
        this.imageGrid.gridWidth = gridWidth;
        this.imageGrid.render(this.imageList, this.selectedMap);

        // display select status
        var imageIds = this.selectedMap.keys();
        for(var i=0; i< imageIds.length; i++){
            var imageId = imageIds[i];
            if(this.selectedMap.get(imageId) == true){
                this._selectImage(imageId);
            }
        }
    },

    doShowAll : function() {
            // do filter
        this.imageList = this.rawImageList;

        this.unselectAllImages();

        // refresh image container
        this.refreshImageContainer();

        this.updateStatuBar();
    },

    /**
     * view image for thumbnail type
     *
     * @method doViewAS
     */
    doViewAS : function() {

        var thumbnailType = null;
        if (document.getElementById("thumbnailTypeSmallMI").getAttribute("checked") == 'true') {
            thumbnailType = 'small';
        } else if (document.getElementById("thumbnailTypeNormalMI").getAttribute("checked") == 'true') {
            thumbnailType = 'normal';
        } else if (document.getElementById("thumbnailTypeLargeMI").getAttribute("checked") == 'true') {
            thumbnailType = 'large';
        }
        this.imageGrid.setThumbnailType(thumbnailType);
        this.imageGrid.isShowImageSize = (document.getElementById("showImageSizeMI").getAttribute("checked") == 'true');
        this.imageGrid.isShowImageName = (document.getElementById("showImageNameMI").getAttribute("checked") == 'true');

        // refresh image container
        this.refreshImageContainer();
    },

    /**
     * browse directory
     *
     * @method browseDir
     */
    browseDir : function() {

        var nsIFilePicker = Ci.nsIFilePicker;
        var filePicker = Cc['@mozilla.org/filepicker;1'].createInstance(nsIFilePicker);
        filePicker.init(window, this.getI18NString('selectFloderTitle'), nsIFilePicker.modeGetFolder);

        // locate current directory
        var destPath = document.getElementById("savedPathMenulist").value;
        var dest = ImageHandler.FileUtils.toDirectory(destPath);
        if (dest) {
            filePicker.displayDirectory = dest;
        }
        var result = filePicker.show();
        if (result == nsIFilePicker.returnOK) {
            this._addSavedFolderPath(filePicker.file.path);
        }
    },

    askSavedFolder : function() {

        // locate current directory
        var destPath = document.getElementById("savedPathMenulist").value;
        var dest = ImageHandler.FileUtils.toDirectory(destPath);

        if (!dest) {
            alert(this.getI18NString('invalidSaveFolder'));
            return null;;
        }

        //Create sub-folder if need
        if(this.settings.isCreatedFolderByTitle()){

            var subFolderName = ImageHandler.FileUtils.makeFolderNameByTitle(window.document.title);


            //open FolderName Confirmation Popup
            if (this.settings.isShowSubfolderNameConfirmationPopup()) {

                //prepare parameter
                var folders = [];
                if (dest.isDirectory()) {
                    var dirEntries = dest.directoryEntries;
                    while (dirEntries.hasMoreElements()) {
                        var entry = dirEntries.getNext();
                        entry.QueryInterface(Components.interfaces.nsIFile);
                        if(entry.isDirectory()){
                            folders.push(entry);
                        }
                    }
                }

                // sort by last modified time DESC
                folders.sort(function(folder1, folder2){
                    return -(folder1.lastModifiedTime - folder2.lastModifiedTime);
                });

                var folderNames = [subFolderName];
                folders.forEach(function(folder){
                    folderNames.push(folder.leafName);
                });

                var params = {
                    input: {
                        savedfolderNames: folderNames
                    },
                    output: {
                        savedFolderName: null
                    }
                };

                var confirmDialog = window.openDialog("chrome://imagehandler/content/folderConfirmation.xul", "", "chrome, dialog, modal, centerscreen, resizable=yes", params);
                confirmDialog.focus();

                //handle result
                var result = params.output.savedFolderName;
                if(result!=null && result.trim() != ""){
                    subFolderName = result;
                }
            }

            var subFolder = ImageHandler.FileUtils.createFolder(destPath, subFolderName);
            if(subFolder != null){
                dest = subFolder;
            }
        }

        return dest;
    },

    /**
     * show DownloadManager UI
     *
     * @method showDownloadManagerUI
     */
    showDownloadManagerUI : function() {

        // And finally show download manager
        var dm_ui = Cc["@mozilla.org/download-manager-ui;1"].createInstance(Ci.nsIDownloadManagerUI);
        if (!dm_ui.visible && !ImageHandler.Settings.hasWinTaskbar()) {
            dm_ui.show(window, "", Ci.nsIDownloadManagerUI.REASON_NEW_DOWNLOAD);
        }
    },

    selectAllImages: function(){

        this.selectedMap = new ImageHandler.HashMap();
        for ( var i = 0; i < this.imageList.length; i++) {
            var img = this.imageList[i];
            this._selectImage(img.id);
        }
        this.updateStatuBar();
        ImageHandler.Logger.debug("select all images ");
    },

    unselectAllImages: function(){

        this.selectedMap = new ImageHandler.HashMap();
        for ( var i = 0; i < this.imageList.length; i++) {
            var img = this.imageList[i];
            this._unselectImage(img.id);
        }
        this.updateStatuBar();
        ImageHandler.Logger.debug("Unselect all images ");
    },

    _selectImage: function(imageId){
        this.selectedMap.put(imageId, true);
        var checkbox = document.getElementById(imageId + "-CheckBox");
        if (checkbox) {
            checkbox.setAttribute("checked", true);
        }
        var imageCell = document.getElementById(imageId + "-CellBox");
        if(imageCell){
            ImageHandler.XulUtils.addClass(imageCell,"image-cell-selected");
        }
    },

    _unselectImage: function(imageId){
        this.selectedMap.put(imageId, false);
        var checkbox = document.getElementById(imageId + "-CheckBox");
        if (checkbox) {
            checkbox.setAttribute("checked", false);
        }
        var imageCell = document.getElementById(imageId + "-CellBox");
        if(imageCell){
            ImageHandler.XulUtils.removeClass(imageCell,"image-cell-selected");
        }
    },

    selectSimilarImages: function(element){

        //Find match URL
        var imageInfo = this.getImageFromPopupNode(element);
        if(!imageInfo){
            return;
        }

        var imageURLDomain = imageInfo.url.substring(0, imageInfo.url.lastIndexOf('/'));
        ImageHandler.Logger.debug("Popup node: " + element.nodeName + ", ImageInfo = " + imageInfo + ", ImageURLDomain = " + imageURLDomain);

        //Select similar images
        var re = new RegExp(imageURLDomain);
        this.selectedMap = new ImageHandler.HashMap();
        for ( var i = 0; i < this.imageList.length; i++) {
            var img = this.imageList[i];
            if(re.test(img.url)){
                this._selectImage(img.id);
            }else{
                this._unselectImage(img.id);
            }
        }

        this.updateStatuBar();
        ImageHandler.Logger.debug("select similar images ");
    },

    handleOpenContextMenu: function(){
        var element = document.popupNode;
        var isImageCell = (this.getImageFromPopupNode(element) != null);
        document.getElementById("selectSimilarMenuItem").hidden = !isImageCell;
    },

    getImageFromPopupNode: function(popupNode){

        var imageId = null;
        if (popupNode.nodeName == 'image') {
            imageId = popupNode.getAttribute("id");
        } else {
            var node = popupNode;
            while(node != null && node.nodeName != 'row'){
                var nodeId = node.getAttribute("id");
                if(nodeId){
                    imageId = /\d+/.exec(nodeId)
                    break;
                }
                node = node.parentNode;
            }
        }

        //Find match ImageInfo
        var imageInfo = null;
         for ( var i = 0; i < this.imageList.length; i++) {
            var img = this.imageList[i];
            if(img.id == imageId){
                imageInfo = img;
                break;
            }
        }

        return imageInfo;
    },

    handleClickOnImage: function(imageId){
      ImageHandler.Logger.debug("select image: " + imageId);
      var isSelected = this.selectedMap.get(imageId);
      if(isSelected){//switch status
          this._unselectImage(imageId);
      }else{
          this._selectImage(imageId);
      }
      this.updateStatuBar();
    },

    updateStatuBar: function(){
        // update status bar
        var oldImageConut = this.rawImageList.length;
        var newImageConut = this.imageList.length;
        var selectedImageConut = 0;
        var values = this.selectedMap.values();
        for (var i = 0; i < values.length; i++) {
            if(values[i] == true){
                selectedImageConut++;
            }
        }
        document.getElementById("filterStat").label = this.getFormattedString("statusBarText",[newImageConut, selectedImageConut, oldImageConut]);
    },

    /**
     * save image to local
     *
     * @method doSaveImages
     */
    doSaveImages : function(images) {

        // locate saved directory
        var dest = this.askSavedFolder();
        if (!dest) {
            return;
        }

        // Collect saved files
        var savedImages = new Array();
        for ( var i = 0; i < this.imageList.length; i++) {
            var img = this.imageList[i];
            if (this.selectedMap.get(img.id) == true) { // saved selected image only
                savedImages.push(img);
            }
        }

        if(savedImages.length == 0){
           return;
        }

        var oldDownloadProgressListener = this.progressListener;
        var newDownloadProgressListener = new ImageHandlerChrome.DownloadProgressListener(savedImages.length);
        this.progressListener = newDownloadProgressListener;
        var stringsBundle = this.getStringsBundle();

         var notificationTitle = stringsBundle.getFormattedString("saveNotificationTitleMultiple", [ savedImages.length ]);
         var notification = new ImageHandlerChrome.Notification(notificationTitle, dest.path, this.browser, this.popupNotifications);
         notification.show();

        var privacyInfo = ImageHandlerChrome.getPrivacyInfo();
        var downloadSession = new ImageHandler.DownloadSession(savedImages, dest, privacyInfo, oldDownloadProgressListener, newDownloadProgressListener, this.postSavedListeners, stringsBundle, true);
        downloadSession.saveImages();
    },

    getStringsBundle: function(){
        // Get a reference to the strings bundle
        if(this.stringsBundle == null){
            this.stringsBundle = document.getElementById("ip-string-bundle");
        }
        return this.stringsBundle;
    },

    getI18NString: function(key){
        // Get a reference to the strings bundle
        var stringsBundle = this.getStringsBundle();
        return stringsBundle.getString(key);
    },

    getFormattedString : function(key, parameters){
        // Get a reference to the strings bundle
        var stringsBundle = this.getStringsBundle();
        return stringsBundle.getFormattedString(key, parameters);
    }
};

/** **************** DownloadProgressListener Object Class ******************** */
/**
 * Provides the DownloadProgressListener class
 *
 * @namespace ImageHandler
 * @class ImageHandlerChrome.DownloadProgressListener
 * @constructor
 */
ImageHandlerChrome.DownloadProgressListener = function(totalCount) {
    this.completedCount = 0;
    this.totalCount = totalCount;
    this.id = Date.now();
};

ImageHandlerChrome.DownloadProgressListener.prototype = {

    onDownloadStateChange : function(aState, aDownload) {
    },

    onStateChange : function(webProgress, request, stateFlags, status) {

        // NOTE: reload all Chrome will cause "Components is not defined" error,
        // restart firefox is OK
        if (typeof Components === "undefined") {
            return;
        }

        var wpl = Components.interfaces.nsIWebProgressListener;

        var isFinished = (stateFlags & wpl.STATE_STOP);

        if (isFinished) {
            this.completedCount = this.completedCount + 1;
            var totalProgress = Math.ceil((this.completedCount / this.totalCount) * 100);


            if (document) {
                var downloadMeter = document.getElementById("downloadMeter");
                var downloadStat = document.getElementById("downloadStat");

                if (downloadMeter) { //check null since the ImageHandler dialog may be closed
                    downloadMeter.value = totalProgress;
                }

                if (downloadStat) { //check null since the ImageHandler dialog may be closed
                    downloadStat.label = totalProgress + "%";
                }
            }

            if ((typeof ImageHandler != "undefined") && (ImageHandler != null)) {  //check null since the ImageHandler dialog may be closed
                 ImageHandler.Logger.debug("Listener id =" + this.id + ", Downloaded: " + totalProgress);
            }
        }
    },

    onStatusChange : function(webProgress, request, status, message) {
    },
    onLocationChange : function(webProgress, request, location) {
    },
    onProgressChange : function(webProgress, request, curSelfProgress, maxSelfProgress, curTotalProgress,
            maxTotalProgress) {
    },
    onSecurityChange : function(webProgress, request, state) {
    }
};

/**
 * Init Controller.
 */
(function() {
    this.init();
}).apply(ImageHandlerChrome.Controller);
