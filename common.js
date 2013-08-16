/**
 * ImageHandlerChrome namespace.
 */
if ("undefined" == typeof (ImageHandlerChrome)) {

	var ImageHandlerChrome = {};

	ImageHandlerChrome.openOptionsDialog = function(event) {
		if (event) {
			event.stopPropagation();
		}
		openDialog('chrome://imagehandler/content/options.xul', 'Options',
				'chrome,toolbar,resizable,centerscreen,modal=no,dialog=yes');
	};

	ImageHandlerChrome.openAboutDialog = function(event) {
		if (event) {
			event.stopPropagation();
		}
		openDialog('chrome://imagehandler/content/about.xul', '',
				'chrome,titlebar,resizable,centerscreen,modal=no,dialog=yes');
	};

}
