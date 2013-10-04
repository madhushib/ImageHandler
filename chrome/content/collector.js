/** **************** Collector Class ******************** */
Components.utils.import("resource://imagehandler/common.js");
Components.utils.import("resource://imagehandler/settings.js");
Components.utils.import("resource://imagehandler/xulUtils.js");
Components.utils.import("resource://imagehandler/fileUtils.js");
Components.utils.import("resource://imagehandler/model.js");
Components.utils.import("resource://gre/modules/FileUtils.jsm");
Components.utils.import("resource://imagehandler/download.js");

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
     *
     * @method onDblClick
     */
	onDblClick : function(event) {
		 ImageHandler.Logger.debug("on Double click");
		 if(ImageHandler.Settings.isDoubleclickImageToSaveEnabled()){
		     var imageElement = ImageHandlerChrome.Collector.detectImageElement(event);
		     if(imageElement){
		         ImageHandlerChrome.Collector.saveImageFromElement(imageElement);
		     }
		 }
	},

	/**
     * callback function for dragstart event
     *
     * @method onDragend
     */
	onDragstart : function(event) {
	    ImageHandlerChrome.Collector.dragEvent = event;
	    ImageHandler.Logger.debug("onDraggesture, node="+ event.target +", clientX=" + event.clientX + ", clientY=" + event.clientY
	        +", screenX=" + event.screenX + ", screenY=" + event.screenY);
	},

	/**
     * callback function for dragend event
     *
     * @method onDragend
     */
	onDragend : function(event) {
		 ImageHandler.Logger.debug("On dragend");
		 this.image = new Array();
		 
		 if(ImageHandler.Settings.isDragImageToSaveEnabled()){
		     var dragEvent = ImageHandlerChrome.Collector.dragEvent;
		     dragEvent = (dragEvent == null? event : dragEvent);
		     var imageElement = ImageHandlerChrome.Collector.detectImageElement(dragEvent);
		     if(imageElement){
		         this.image=ImageHandlerChrome.convertAndTidyImage([imageElement]);
		     }
		 }
		 
		 var file = FileUtils.getFile("ProfD", ["dataaab.txt"]);
	    	NetUtil.asyncFetch(file, function(inputStream, status) {
	    		  if (!Components.isSuccessCode(status)) {
	    		    alert("errror read")
	    		    return;
	    		  }
	    		  dataa = NetUtil.readInputStreamToString(inputStream, inputStream.available());
	    		  this.set(dataa);
	    		});	
	        set = function(data){
	        	ImageHandlerChrome.Collector.addrem(JSON.parse(data),this.image);
	        }   
	},
	
	addrem:function(old,img){

		//alert(this.image);
		var converted = JSON.parse(JSON.stringify(img));
		converted = converted.concat(old);
		
		var JSONimages = JSON.stringify(converted);
    	var file = FileUtils.getFile("ProfD", ["dataaab.txt"]);
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
    	  var notification = new ImageHandlerChrome.Notification("Added to Favorite", img[0].url.substring(img[0].url.lastIndexOf('/') + 1, img[0].url.length) , gBrowser.selectedBrowser);
          notification.show();
    	});
		
	},

	/**
     * Save image from the given element when the element is a image
     *
     * @method saveImageFromElement
     */
	saveImageFromElement : function(imageElement) {

		 var image = new ImageHandler.ImageInfo(1, imageElement, 0);
	     ImageHandlerChrome.ImageUtils.updateFileExtensionByMIME(image);
	     ImageHandlerChrome.ImageUtils.updateFileNameFromCache(image);

		 var destDir = ImageHandlerChrome.Collector.getOrCreateSavedFolder();

         var stringsBundle = document.getElementById("ip-string-bundle");

         var notificationTitle = stringsBundle.getFormattedString("saveNotificationTitleSingle", [ image.getFileNameExt() ]);
         var notification = new ImageHandlerChrome.Notification(notificationTitle, destDir.path, gBrowser.selectedBrowser);
         notification.show();

         var privacyInfo = ImageHandlerChrome.getPrivacyInfo();
	     var downloadSession = new ImageHandler.DownloadSession([image], destDir, privacyInfo, null, null, null, stringsBundle, false);
	     downloadSession.saveImages();
	},

	/**
     * @return a nsIFile object
     */
	getOrCreateSavedFolder : function() {
        // Get document title
        var currentTabTitle = ImageHandlerChrome.getCurrentBrowser().contentDocument.title;

        var destPath = FileUtils.getDir("DfltDwnld", []).path;
        var paths = ImageHandler.Settings.getSavedFolderPaths();
        if(paths != null && paths.length > 0){
            destPath = (paths[0] != null && paths[0] != ""? paths[0] : destPath);
        }
        ImageHandler.Logger.debug("destPath =  " + destPath);
        var destDir = ImageHandler.FileUtils.toDirectory(destPath);

        // Create sub-folder if need
        if(ImageHandler.Settings.isCreatedFolderByTitle()){
            var subFolderName = ImageHandler.FileUtils.makeFolderNameByTitle(currentTabTitle);
            destDir = ImageHandler.FileUtils.createFolder(destPath, subFolderName);
        }

        return destDir;
    },

   /**
     * @return a nsIFile object
     */
	detectImageElement : function(event) {

	     var htmlElement = event.target;
	     var tagName = htmlElement.tagName.toLowerCase();
		 var isOnImage = (tagName=="img");
		 var isOnLink = (tagName=="a");
		 ImageHandler.Logger.debug("trigger on image? " + isOnImage + " or on link = " + isOnLink + ", tag name = " + tagName);

		 if(isOnImage){
    		 return htmlElement;
         }

         // Check image link
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

         // Check all images under parent node on the same position
         var eventX = event.clientX;
         var eventY = event.clientY;

         var parentNode = htmlElement;
         for(var loop=0; (loop<2 && parentNode!=null); loop++) { // until 2nd level parent
             var imageElements = parentNode.getElementsByTagName('img');
             ImageHandler.Logger.debug("detect image, parentNode="+ parentNode +", images=" + imageElements.length +", eventX=" + eventX + ", eventY=" + eventY);

             if(imageElements.length == 1){
                 return imageElements[0];
             }

             for(var i=0; i<imageElements.length; i++) {
                 var imgElem = imageElements[i];
                 var point = ImageHandlerChrome.Collector._getPosition(imgElem);
                 var isBetweenX = (point.left < eventX) && (eventX < (point.left + imgElem.offsetWidth));
                 var isBetweenY = (point.top < eventY) && (eventY < (point.top + imgElem.offsetHeight));
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
	     if (htmlElement && htmlElement.offsetParent) {
	 	    do {
	 	         curleft += htmlElement.offsetLeft;
	 	         curtop += htmlElement.offsetTop;
	 	     } while (htmlElement = htmlElement.offsetParent);
	     }
	     return {left :curleft, top: curtop};
    }
};

window.addEventListener("dblclick",ImageHandlerChrome.Collector.onDblClick,false);
window.addEventListener("dragstart",ImageHandlerChrome.Collector.onDragstart,false);
window.addEventListener("dragend",ImageHandlerChrome.Collector.onDragend,false);
ImageHandler.Logger.info("Created Collector and registered event listener");