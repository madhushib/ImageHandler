/** **************** Controller Class ******************** */
/*Handle events hapen on Pick window*/
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

Components.utils.import("resource://gre/modules/NetUtil.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");

/**
 * Provides the controller
 *
 * @namespace ImageHandlerChrome
 * @class ImageHandlerChrome.Controller
 * @constructor
 * calls on whn the image selection window (pick.xul) appear
 * 
 */
ImageHandlerChrome.Controller = {

    /**
     * callback function for loading pick window
     * @method init
     */
    init : function() {
        // Get preferences and set attributes according to the prams passed
        this.settings = ImageHandler.Settings;
        this.rawImageList = window.arguments[0].imageList;
        this.browser = window.arguments[0].browser;
        this.popupNotifications = window.arguments[0].popupNotifications;
        var postSavedListenersFromArgument = window.arguments[0].listeners;

        /*
         * Register the given listener to extend the after image saving behavior
         * The given listener must have a afterSavedImages() method.
         */
        var postSavedListener = {
            afterSavedImages: function(savedFolder, images){
                //open Explorer after saved if need
                if (ImageHandler.Settings.isOpenExplorerAfterSaved()) {
                    ImageHandler.FileUtils.revealDirectory(savedFolder);	//try to open saved folder if settings are requred so
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
//set postsave lisnet according to the parameter from window
        this.postSavedListeners = [postSavedListener];
        this.postSavedListeners =  this.postSavedListeners.concat(postSavedListenersFromArgument);
        ImageHandler.Logger.debug("Argument listeners: " + postSavedListenersFromArgument.length);
        ImageHandler.Logger.debug("PostSavedListeners: " + this.postSavedListeners.length);

        this.imageList = this.rawImageList;	//the image list
        this.selectedMap = new ImageHandler.HashMap();	//datastructure for images
        this.filter = null;		
        this.progressListener = null;

        // init image grid
        var gridSize = window.innerWidth - 6;	//leave 3 units from each side of window width

        var thumbnailType = this.settings.getThumbnailType();	//small, medium or large
        var isShowImageSize = this.settings.isShowImageSize();	//set according to user preferences
        var isShowImageName = this.settings.isShowImageName();	//set according to user preferences
        //create image grid
        this.imageGrid = new ImageHandlerChrome.ImageGrid("imageContainer", gridSize, thumbnailType, isShowImageSize,
                isShowImageName);

        // Store the resize flag for first open
        this.MIN_WINDOW_WIDTH = 772;
        this.isResizeToMinWidth = false;
    },

    /**
     * callback function for loading pick.xul window
     *	this will be called at the click of favourite button as well, arguments are handled accordingly 
     * @method loadPickWindow
     */
    loadPickWindow : function() {

        // init window title
        window.document.title = window.arguments[0].title;
        var type = window.arguments[0].type;
        if(type == "fav"){	//set button label to be "Remove from fav" if in favourite window
        	document.getElementById("add-to-fav").label = "Remove From Favorite";
        }
        else{				//add "add to favourite label
        	document.getElementById("add-to-fav").label = "Add to Favorite";
        }
		
        //set dodument attributes of showImageSize, showImageName according to user preferences
        var isShowImageSize = this.settings.isShowImageSize();
        var isShowImageName = this.settings.isShowImageName();
        document.getElementById("showImageSizeMI").setAttribute("checked", isShowImageSize);
        document.getElementById("showImageNameMI").setAttribute("checked", isShowImageName);

        this._renderSavedFolderPathMenuList();	//render the list of folder paths available at save menu list
        this.doShowAll();						//refresh image container to show changes
        
        // add eventlistner for resize & call onResize function
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

    /*
     * Add new folder pathe to saved folder list and re-render
     */
    _addSavedFolderPath : function(path) {
        this.settings.addSavedFolderPath(path);	
        //update UI
        this._renderSavedFolderPathMenuList();
    },

    /*
     * Remove a path from saved paths list
     */
    clearAllSavedPaths : function(path) {
        this.settings.clearSavedFolderPaths(path);
        //update UI
        this._renderSavedFolderPathMenuList();
    },

    /**
     * callback function for unloading pick window
     *	at the point of closing pick.xul
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

    /*
     * If container is resized and size is larger than prefered MinWidth then set window according to size of content
     * We cannot have exact size user prefer as image elements are of fixed size, size can take discrete values only
     */
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
     * Clean old image grid, render new one and indicate the selected images
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

 /*
  * Call this to refresh image containes and statBar when a change is made
  */
    doShowAll : function() {
            // do filter
        this.imageList = this.rawImageList;
        this.unselectAllImages();

        // refresh image container
        this.refreshImageContainer();
        this.updateStatuBar();	//to show number of images selected and available
    },

    /**
     * view image for thumbnail type
     * large/ medium or small
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
       // set imageGrid attributes
        this.imageGrid.setThumbnailType(thumbnailType);
        this.imageGrid.isShowImageSize = (document.getElementById("showImageSizeMI").getAttribute("checked") == 'true');
        this.imageGrid.isShowImageName = (document.getElementById("showImageNameMI").getAttribute("checked") == 'true');

        // refresh image container
        this.refreshImageContainer();
    },
    
    /*
     * Tha callback function On click of add/remove favourite button 
     */
    addRemoveFav : function(){  	
        var file = FileUtils.getFile("ProfD", ["FavouriteFile"]);
        //open JSON favourite file and read current image data
    	NetUtil.asyncFetch(file, function(inputStream, status) {
    		  if (!Components.isSuccessCode(status)) {
    			  alert("Unexpected Error Ocurred!");		 
    		  }
    		  dataa = NetUtil.readInputStreamToString(inputStream, inputStream.available());
    		  this.set(dataa);
    		});	
        set = function(data){
        	ImageHandlerChrome.Controller.addRemFromFavFile(JSON.parse(data));
        }
    },
    
    addRemFromFavFile:function(old){
    	var type = window.arguments[0].type;	//add or remove  	
    	var selected = new Array();
        for ( var i = 0; i < this.imageList.length; i++) {
            var img = this.imageList[i];
            //get list of current selected images
            if(selected.length == 0){
           		return;
        	}
            if (this.selectedMap.get(img.id) == true) { // saved selected image only
                selected.push(img);
            }
        }    
        var converted = JSON.parse(JSON.stringify(selected));	//conver selected array in to JSON string
    	var currentList = new Array();
    	var imageListTemp = new Array();
        
        if(type == "fav"){		//to remove from favorite
        	for(var i = 0 ; i < old.length ; i++){
        		var state = false;
        		for(var j = 0 ; j < converted.length ; j++){	//check wether selected images are already in the favourites
        			if(old[i].url==converted[j].url){
        				state = true;
        			}
        		}
        		if(state == false){
        			currentList.push(old[i]);	//if not, push into currentLIst so selected images are removed
        		}
        	}
        	for(var i = 0 ; i < this.imageList.length ; i++){	//get images in marked imageList
        		var state = false;
        		for(var j = 0 ; j < converted.length ; j++){
        			if(this.imageList[i].url==converted[j].url){	//check they were in the checked-to-be-removed list
        				state = true;
        			}
        		}
        		if(state == false){
        			imageListTemp.push(this.imageList[i]);	//add unselected images 
        		}
        	}
        	this.imageList = imageListTemp;
        }
        else{	//add to favourite 
        	currentList = old.concat(converted);
        	alert("Added to Favorites");
        }
    	this.resetfav(currentList);	//reset favourite list
    },
    
    /*
     * Write back the edited favourite image list
     */
    resetfav : function(favImages){
    	var JSONimages = JSON.stringify(favImages);
    	var file = FileUtils.getFile("ProfD", ["FavouriteFile"]);
    	var ostream = FileUtils.openSafeFileOutputStream(file)

    	var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
    	converter.charset = "UTF-8";
    	var istream = converter.convertToInputStream(JSONimages);

    	// The last argument (the callback) is optional.
    	NetUtil.asyncCopy(istream, ostream, function(status) {
    	  if (!Components.isSuccessCode(status)) {
    	    alert("Failed writing");
    	    return;
    	  }
    	});	
    	//after removing or addong to the favourites
    	this.refreshImageContainer();
        this.updateStatuBar();
    },

    /**
     * browse directory
     * executed when click on browserDir icon on pick window
     * @method browseDir
     */
    browseDir : function() {
        var nsIFilePicker = Ci.nsIFilePicker;
        var filePicker = Cc['@mozilla.org/filepicker;1'].createInstance(nsIFilePicker);
        filePicker.init(window, this.getI18NString('selectFloderTitle'), nsIFilePicker.modeGetFolder);
        // locate current directory
        var destPath = document.getElementById("savedPathMenulist").value;	//get file path
        var dest = ImageHandler.FileUtils.toDirectory(destPath);	//convert to dorectory
        if (dest) {
            filePicker.displayDirectory = dest;
        }
        var result = filePicker.show();
        if (result == nsIFilePicker.returnOK) {
            this._addSavedFolderPath(filePicker.file.path);	//add new path to be shown in saved folder path list
        }
    },

/*
 * To save images the destination folder is asked from user
 */
     askSavedFolder : function() {
        // locate current directory
        var destPath = document.getElementById("savedPathMenulist").value;
        var dest = ImageHandler.FileUtils.toDirectory(destPath);
        if (!dest) {
            alert(this.getI18NString('invalidSaveFolder'));
            return null;;
        }
        //Create sub-folder if user prefer to save from tabtitle
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

                // sort by last modified time 
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

    /*
     * Execute when select all button clicked
     */
    selectAllImages: function(){
        this.selectedMap = new ImageHandler.HashMap();
        for ( var i = 0; i < this.imageList.length; i++) {	//check all image boxes
            var img = this.imageList[i];
            this._selectImage(img.id);
        }
        this.updateStatuBar();
        ImageHandler.Logger.debug("select all images ");
    },

    /*
     * On unselect all button
     */
    unselectAllImages: function(){
        this.selectedMap = new ImageHandler.HashMap();
        for ( var i = 0; i < this.imageList.length; i++) {
            var img = this.imageList[i];
            this._unselectImage(img.id);
        }
        this.updateStatuBar();
        ImageHandler.Logger.debug("Unselect all images ");
    },

    /*
     * Select each image, add to selected map and check the checkbox
     */
    _selectImage: function(imageId){
        this.selectedMap.put(imageId, true);	//set Mapvalue to be selected
        var checkbox = document.getElementById(imageId + "-CheckBox");
        if (checkbox) {	//indicate box to be checked
            checkbox.setAttribute("checked", true);
        }
        var imageCell = document.getElementById(imageId + "-CellBox");
        if(imageCell){	//if a image cell is selected add class it to class image-sell-selected
            ImageHandler.XulUtils.addClass(imageCell,"image-cell-selected");
        }
    },

    /*
     * Unselect image by  set map value and uncheck checkbox
     */
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

    /*
     * On right click popup menu of pick window, the "select similar image" trigger this method
     * similarity checked by URL match
     */
    selectSimilarImages: function(element){
        //Find match URL
        var imageInfo = this.getImageFromPopupNode(element);
        if(!imageInfo){
            return;
        }
        var imageURLDomain = imageInfo.url.substring(0, imageInfo.url.lastIndexOf('/')); //the last index of image URL-probably image name
        ImageHandler.Logger.debug("Popup node: " + element.nodeName + ", ImageInfo = " + imageInfo + ", ImageURLDomain = " + imageURLDomain);

        //Select similar images
        var re = new RegExp(imageURLDomain);	//conver image URL domain in to RegExp, help to search patterns
        this.selectedMap = new ImageHandler.HashMap();
        for ( var i = 0; i < this.imageList.length; i++) {
            var img = this.imageList[i];
            if(re.test(img.url)){	//compare with images in list
                this._selectImage(img.id);	//select if similar
            }else{
                this._unselectImage(img.id);
            }
        }
        this.updateStatuBar();
        ImageHandler.Logger.debug("select similar images ");
    },

/*
 * Handle the right click event on pick window
 * Open context menu of select all, unselect all which includes select similar items if clicked on a image
 */  
    handleOpenContextMenu: function(){
        var element = document.popupNode;
        var isImageCell = (this.getImageFromPopupNode(element) != null);
        document.getElementById("selectSimilarMenuItem").hidden = !isImageCell;	//hide "selectSimilar" if not clicked on imageCell
    },

    /*
     * To take image element if right clicked on an image on pick window
     */
    getImageFromPopupNode: function(popupNode){
        var imageId = null;
        if (popupNode.nodeName == 'image') {
            imageId = popupNode.getAttribute("id");
        } else {	//Find image in a chiled node of popup node
            var node = popupNode;
            while(node != null && node.nodeName != 'row'){
                var nodeId = node.getAttribute("id");
                if(nodeId){
                    imageId = /\d+/.exec(nodeId)	//one or more digits
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

 /*
  * Handle click on image of pick window
  * Select or deselect image accordingly
  */
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

    /*
     * Set the old/new and selected image counts into filterStat element
     */
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
        //Set download progress attributes
        var oldDownloadProgressListener = this.progressListener;
        var newDownloadProgressListener = new ImageHandlerChrome.DownloadProgressListener(savedImages.length);
        this.progressListener = newDownloadProgressListener;
        var stringsBundle = this.getStringsBundle();

        //Set save notification
         var notificationTitle = stringsBundle.getFormattedString("saveNotificationTitleMultiple", [ savedImages.length ]);
         var notification = new ImageHandlerChrome.Notification(notificationTitle, dest.path, this.browser, this.popupNotifications);
         notification.show();
		
        //get privacy information
        var privacyInfo = ImageHandlerChrome.getPrivacyInfo();
        //Create download session and call to save images
        var downloadSession = new ImageHandler.DownloadSession(savedImages, dest, privacyInfo, oldDownloadProgressListener, newDownloadProgressListener, this.postSavedListeners, stringsBundle, true);
        downloadSession.saveImages();
    },

    /*
     * Get string bundel from properties
     */
    getStringsBundle: function(){
        // Get a reference to the strings bundle
        if(this.stringsBundle == null){
            this.stringsBundle = document.getElementById("ip-string-bundle");
        }
        return this.stringsBundle;
    },

    /*
     * Get international string bundel according to Locale files
     */
    getI18NString: function(key){
        // Get a reference to the strings bundle
        var stringsBundle = this.getStringsBundle();
        return stringsBundle.getString(key);
    },

    /*
     * Format string given key and parameters using string bundel
     */
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
 * Reused to complete the structure of the calls to Download.js in modules
 */
ImageHandlerChrome.DownloadProgressListener = function(totalCount) {
    this.completedCount = 0;
    this.totalCount = totalCount;
    this.id = Date.now();
};

ImageHandlerChrome.DownloadProgressListener.prototype = {

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
