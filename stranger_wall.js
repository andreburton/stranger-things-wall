/*

This program integrates with Neopixels. It listens to firebase for new messages
and when they arrive, this program populates the neopixels strand designed 
to simulate a wall from the Stranger Things movie.

Author: Andre S. Burton

*/

function execute() {
  
    // The three modes you can run in, passed in as a command line argument: 
    // normal - display letters with no warning or info messages in the console.
    // debug - same as normal but display warning and info messages in the console.
    // test - run a strand test to validate strand connectivity and letter positions on the wall.
    var mode = process.argv[2] || null;
    if (mode) {
      mode = mode.toLowerCase();
    }
    // Prefix debug messages with this.
    var MODE_DEBUG_PREFIX = '[INFO]: ';
    
    // Read in the strand position to light mapping.
    var fs = require("fs");
    var config = JSON.parse(fs.readFileSync("stranger_wall_config_pub.json"));
    var letters = config.letter_map;
    if (mode == 'debug') {
      console.log(MODE_DEBUG_PREFIX + 'initializing the firebase connection.');
    }

    // Set the number of LEDS in the strand.  By default == 50.  Initialize the pixelData array
    // which is used to set the color (0 - 255) on each LED unit.
    var NUM_LEDS = config.number_of_leds, pixelData = new Uint32Array(NUM_LEDS);

    if (mode == 'debug') {
      console.log(MODE_DEBUG_PREFIX + 'configuration file loaded.');
      console.log(MODE_DEBUG_PREFIX + 'your strand has '+ NUM_LEDS +' LEDS.');
    }
    
    
    // Initialize the strand.
    var ws281x = require('rpi-ws281x-native');
    ws281x.init(NUM_LEDS);
    
    // If the user hits ctrl-c, reset the strand (no lights).
    process.on('SIGINT', function () {
      ws281x.reset();
      process.nextTick(function () { process.exit(0); });
    });
    
    // Print the quit at anytime message to the console.
    console.log('Press <ctrl>+C to exit.');
    
    // Initialize additional vars.
    var letterDisplay;
    var letterPixelData = new Uint32Array(NUM_LEDS);
    var sleep = require('sleep');
    
    //******Establish database connection and query*******************************************
    if (mode == 'test') {
      strandTest();
    }
    else {
      if (mode == 'debug') {
        console.log(MODE_DEBUG_PREFIX + 'initializing the firebase connection to '+ config.firebase_db_url);
      }
    
      var firebase = require('firebase');
    
      // Establish the database connection (without credentials).
      firebase.initializeApp({
        databaseURL: config.firebase_db_url
      });
    
      // Get the target db project.
      var ref = firebase.app().database().ref("messages");
      if (mode == 'debug') {
        console.log(MODE_DEBUG_PREFIX + 'firebase connection established.');
      }
    
      // Get the current timestamp;
      var now = new Date().getTime();
    
      // Create a query that orders the project query results by the timestamp.
      var query = ref.orderByChild('timestamp').startAt(now);
    
      // get new messages as they arrive.
      query.on("child_added", function(snapshot, prevChildKey) {
        var newRecord = snapshot.val();
        console.log('Message received: ' + newRecord.message);
        
        // For each new message that appears in firebase (by way of Firebase), animate.
        animateWordWithWarning(newRecord.message);
      });
  }
  
  
  //****Supporting functions*****************************************************************
  // Use this function to light all letters and align to stranger_wall_config.json positions.
  function strandTest() {
   var test_str = 'abcdefghijklmnopqrstuvwxyz';
   if (mode == 'debug') {
     console.log(MODE_DEBUG_PREFIX + 'running a strand test with this string: '+ test_str);
   }
    animateWord(test_str);
  }
  
  // Animate with the heads up display.
  function animateWordWithWarning(word) {
    // First, set the pixels to a color.
    var color = 0xffcc22;
    for (var i = 0; i < NUM_LEDS; i++) {
      pixelData[i] = color;
    }
    ws281x.render(pixelData);
    
    // Animate through a heads up blink.
    blink();
  
    ws281x.reset();
    ws281x.init(NUM_LEDS);
    reset();
    if (mode == 'debug') {
      console.log(MODE_DEBUG_PREFIX + 'heads up display complete.');
    }
    sleep.msleep(1500); 
  
    // Finally, animate the word.
    animateWord(word);
  
    if (mode == 'debug') {
      console.log(MODE_DEBUG_PREFIX + 'message display complete.');
    }
  }
  
  // Animate without heads up display.
  function animateWord(word) {
    // Loop through each letter of the word and animate (increase and decrease brightness).
    for (var i = 0; i < word.length; i++) {
      var letter = word.charAt(i).toUpperCase();
      var letterPos = letters[letter];
      if (letterPos) {
        animateLetter(letterPos);
        letterPixelData[letterPos] = 0;
      }
      else if (letter == ' ') {
        var blankSleepTime = 1000;
        sleep.msleep(blankSleepTime);
      }
      else {
        // Ignore everything else.
      }
    }
  }
  
  // Reset the strand.
  function reset() {
    for (var i = 0; i < NUM_LEDS; i++) {
      pixelData[i] = 0;
    }
    ws281x.render(pixelData);
    ws281x.reset();
    ws281x.init(NUM_LEDS);
  }
  
  // Animate an individual letter.
  function animateLetter(pos) {
    letterPixelData[pos] = colorwheel((pos*202) % 256);
    ws281x.render(letterPixelData);
    blink();
  }
  
  // Blink the strand.
  function blink() {
    var brightnessInc = 7;
    var maxBrightness = 255;
    var topCountMax = 10;
    var numLoops = topCountMax + (maxBrightness / brightnessInc) * 2;
    var transIntTime = 1000 / 40;
    // Prepare animation.
    var brightness = 0;
    var forwardFlag = true;
    var tempBrightness;
    var topCount = 0;
    var calcLetterTime = 4;
    var dts = Date.now();
    // Light up the strand.
    for (var j = 0; j < numLoops; j++) {
      if (forwardFlag) {
        tempBrightness = brightness + brightnessInc;
        if (tempBrightness > maxBrightness) {
          brightness = maxBrightness;
          topCount = topCount + 1;
          if (topCount > topCountMax) {
            forwardFlag = false;
            topCount = 0;
          }
        }
        else {
          brightness = tempBrightness;
        }
      }
      else {
        tempBrightness = brightness - brightnessInc;
        if (tempBrightness < 0) {
          forwardFlag = true;
          brightness = 0;
        }
        else { 
          brightness = tempBrightness;
        }
      }
      sleep.msleep(transIntTime);
      ws281x.setBrightness(brightness);
    }
  }
  
  // Rainbow-colors, taken from http://goo.gl/Cs3H0v
  function colorwheel(pos) {
    pos = 255 - pos;
    if (pos < 85) { return rgb2Int(255 - pos * 3, 0, pos * 3); }
    else if (pos < 170) { pos -= 85; return rgb2Int(0, pos * 3, 255 - pos * 3); }
    else { pos -= 170; return rgb2Int(pos * 3, 255 - pos * 3, 0); }
  }
  
  function rgb2Int(r, g, b) {
    return ((r & 0xff) << 16) + ((g & 0xff) << 8) + (b & 0xff);
  }
  
  function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
  }
} execute();
