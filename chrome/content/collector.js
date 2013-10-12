/*
 * Madhushib
 */
 /** **************** Collector Class ******************** */
Components.utils.import("resource://imagehandler/common.js");
Components.utils.import("resource://imagehandler/settings.js");
Components.utils.import("resource://imagehandler/xulUtils.js");
Components.utils.import("resource://imagehandler/fileUtils.js");
Components.utils.import("resource://imagehandler/model.js");
Components.utils.import("resource://imagehandler/download.js");

Components.utils.import("resource://gre/modules/FileUtils.jsm");
Components.utils.import("resource://gre/modules/NetUtils.jsm");

/**
 * Provides the collector
 *
 * @namespace ImageHandlerChrome
 * @class ImageHandlerChrome.Collector
 * @constructor
 */
ImageHandlerChrome.Collector = {
    dragEvent: null,

    /**
     * callback function for double click event
     *Save image if preference is set to enable saving
     * @method onDblClick
     * 
     */
	onDblClick : function(event) {
		 ImageHandler.Logger.debug("on Double click");
		 if(ImageHandler.Settings.isDoubleclickImageToSaveEnabled()){
		     var imageElement = ImageHandlerChrome.Collector.detectImageElement(event);		//verify doubleclick event on image
		     if(imageElement){
		         ImageHandlerChrome.Collector.saveImageFromElement(imageElement);
		     }
		 }
	},

	/**
     * callback function for dragstart event
     * identify drag event at the start of drag
     * @method onDragend
     */
	onDragstart : function(event) {
	    ImageHandlerChrome.Collector.dragEvent = event;		//initialize drag event
	    ImageHandler.Logger.debug("onDraggesture, node="+ event.target +", clientX=" + event.clientX + ", clientY=" + event.clientY
	        +", screenX=" + event.screenX + ", screenY=" + event.screenY);
	},

	/**
     * callback function for dragend event
     * At the end of drag, to save image
     * @method onDragend
     */
	onDragend : function(event) {
		 ImageHandler.Logger.debug("On dragend");
		 this.image = new Array();
		 
		 if(ImageHandler.Settings.isDragImageToSaveEnabled()){
		     var dragEvent = ImageHandlerChrome.Collector.dragEvent;	//take drag event
		     dragEvent = (dragEvent == null? event : dragEvent);		//check for null
		     var imageElement = ImageHandlerChrome.Collector.detectImageElement(dragEvent);	//check it is image element
		     if(imageElement){
		         this.image=ImageHandlerChrome.convertAndTidyImage([imageElement]);		//tidy the image and add to array
		     }
		 }
		 
		 var file = FileUtils.getFile("ProfD", ["FavouriteFile"]);		//open file using a browser provided FileUtil functionality
	    	
		 //firefox API call to fetch file as seperate thread without stoping browser
		 //Parameters: file & function to operate on it
	    	NetUtil.asyncFetch(file, function(inputStream, status) {	
	    		  if (!Components.isSuccessCode(status)) {
	    			  alert("Unexpected Error occured!");
	    		  }
	    		  dataa = NetUtil.readInputStreamToString(inputStream, inputStream.available());	//read favourite file
	    		  this.set(dataa);
	    		});	
	    	
	    	// call Collector.appendToFavourite
	    	 set = function(data){
	        	ImageHandlerChrome.Collector.appendToFavouriteFile(JSON.parse(data),this.image);
	        }   
	},
	
	/*
	 * Convert the image element in to JSON data structure and append in to existing favourite file
	 */
	appendToFavouriteFile:function(old,img){
	   	var file = FileUtils.getFile("ProfD", ["FavouriteFile"]);	//call browser functionality to get file
    	var ostream = FileUtils.openSafeFileOutputStream(file)	//open file
    	
    	
    	var converted = JSON.parse(JSON.stringify(img));	//convert image_to_be_saved to JSON type
		converted = converted.concat(old);					//appent to JASON data array read from file
		var JSONimages = JSON.stringify(converted);			//Stringfy it to write to file
    	//convert JSON datastructure to be writable
    	var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
    	converter.charset = "UTF-8";
    	var istream = converter.convertToInputStream(JSONimages);
		
    	//copy to file
     	NetUtil.asyncCopy(istream, ostream, function(status) {
    	  if (!Components.isSuccessCode(status)) {
    	    alert("Failed writing");
    	    return;
    	  }
    	  //notify in popup
    	  var notification = new ImageHandlerChrome.Notification("Added to Favorite", img[0].url.substring(img[0].url.lastIndexOf('/') + 1, img[0].url.length) , gBrowser.selectedBrowser);
          notification.show();
    	});
		
	},

	/**
     * Save image from the given element when the element is a image
     *	Calls when doubleClicked on image
     * @method saveImageFromElement
     */
	saveImageFromElement : function(imageElement) {

		 var image = new ImageHandler.ImageInfo(1, imageElement, 0);		//Create ImageInfo Object passing (id->1:only one image is saved by dragging, image, imageTop->0:no ordering required)
	     ImageHandlerChrome.ImageUtils.updateFileExtensionByMIME(image);	//try to update file to MIME extention 
	     ImageHandlerChrome.ImageUtils.updateFileNameFromCache(image);		//try to update file name from cache, for optimization purposes

	     var destDir = ImageHandlerChrome.Collector.getOrCreateSavedFolder();//take folder to be saved in

	     //handle notification
	     var stringsBundle = document.getElementById("ip-string-bundle");	//get dtd data
         var notificationTitle = stringsBundle.getFormattedString("saveNotificationTitleSingle", [ image.getFileNameExt() ]);	//create notification msg
         var notification = new ImageHandlerChrome.Notification(notificationTitle, destDir.path, gBrowser.selectedBrowser);		//create notification
         notification.show();
	
         //get privacy info
         var privacyInfo = ImageHandlerChrome.getPrivacyInfo();
	     //create download session & pass image to save
	     var downloadSession = new ImageHandler.DownloadSession([image], destDir, privacyInfo, null, null, null, stringsBundle, false);
	     downloadSession.saveImages();
	},

	/**
     * @return a nsIFile object
     * get or create new directory to dave image
     */
	getOrCreateSavedFolder : function() {
       
        var currentTabTitle = ImageHandlerChrome.getCurrentBrowser().contentDocument.title;	 // Get document title
		
        var destPath = FileUtils.getDir("DfltDwnld", []).path;			//default destination=default download folder of browser
        var paths = ImageHandler.Settings.getSavedFolderPaths();		//get folder path list indicated in preference
        if(paths != null && paths.length > 0){
            destPath = (paths[0] != null && paths[0] != ""? paths[0] : destPath);	//if 1st element is not empty, set destination to be it
        }
        ImageHandler.Logger.debug("destPath =  " + destPath);
        var destDir = ImageHandler.FileUtils.toDirectory(destPath);	//convert path to a directory

        // Create sub-folder if settings always requre to create folder by tab title
        if(ImageHandler.Settings.isCreatedFolderByTitle()){
            var subFolderName = ImageHandler.FileUtils.makeFolderNameByTitle(currentTabTitle);
            destDir = ImageHandler.FileUtils.createFolder(destPath, subFolderName);
        }
        return destDir;
    },

   /**
     * @return a nsIFile object 
     * @param event such as click or drag
     * 
     */
	detectImageElement : function(event) {
	     var htmlElement = event.target;
	     var tagName = htmlElement.tagName.toLowerCase();
		 var isOnImage = (tagName=="img");
		 var isOnLink = (tagName=="a");
		 ImageHandler.Logger.debug("trigger on image? " + isOnImage + " or on link = " + isOnLink + ", tag name = " + tagName);
		//if clicked on image return it straight
		 if(isOnImage){
    		 return htmlElement;
         }
         // if clicked on image Check image link and return image element within it
         if(isOnLink){
             var imgRegExp = new RegExp("\.png|\.jpg|\.jpeg|\.bmp|\.gif|\.webp|\.tif", "g");
             var link = htmlElement.href.toLowerCase();
             if(link.match(imgRegExp)){
                 var HTML_NS = "http://www.w3.org/1999/xhtml";
                 var imgElem = document.createElementNS(HTML_NS, "img");
                 imgElem.src = link;
                 return imgElem;
             }
         }
         // if it is not a image or link to image,Check all images under parent node on the same position
         var eventX = event.clientX;
         var eventY = event.clientY;
         var parentNode = htmlElement;
         for(var loop=0; (loop<2 && parentNode!=null); loop++) { // check images until 2nd level parent
             var imageElements = parentNode.getElementsByTagName('img');
             ImageHandler.Logger.debug("detect image, parentNode="+ parentNode +", images=" + imageElements.length +", eventX=" + eventX + ", eventY=" + eventY);
            
             if(imageElements.length == 1){	//contain only one image element
                 return imageElements[0];
             }
             for(var i=0; i<imageElements.length; i++) {	//contain many images
                 var imgElem = imageElements[i];
                 var point = ImageHandlerChrome.Collector._getPosition(imgElem);	//exact positon of image
                 var isBetweenX = (point.left < eventX) && (eventX < (point.left + imgElem.offsetWidth));	//check wether it is within the parent X cordinates
                 var isBetweenY = (point.top < eventY) && (eventY < (point.top + imgElem.offsetHeight));	//check wether it is within the parent Y cordinates
                 ImageHandler.Logger.debug("detect image, src="+ imgElem.src +", isBetweenX=" + isBetweenX + ", isBetweenY=" + isBetweenY);
                 if(isBetweenX && isBetweenY){
                     return imgElem;
                 }
             }
             parentNode = parentNode.parentNode;
         }
         return null;
    },

    /**
     * @return the absolute position of html element
     */
	_getPosition : function(htmlElement) {
	     var curleft = 0;
	     var curtop = 0;
	     if (htmlElement && htmlElement.offsetParent) {//Add offsets of HTML element and return original position
	 	    do {
	 	         curleft += htmlElement.offsetLeft;
	 	         curtop += htmlElement.offsetTop;
	 	     } while (htmlElement = htmlElement.offsetParent);
	     }
	     return {left :curleft, top: curtop};
    }
};

//window listners for drag and doubleclick
window.addEventListener("dblclick",ImageHandlerChrome.Collector.onDblClick,false);
window.addEventListener("dragstart",ImageHandlerChrome.Collector.onDragstart,false);
window.addEventListener("dragend",ImageHandlerChrome.Collector.onDragend,false);
ImageHandler.Logger.info("Created Collector and registered event listener");