// ============================================================
//  TerriRun - configuration
//  1) Paste your Firebase web-app settings below (see README.md)
//  2) Tweak the game rules if you want
// ============================================================
window.APP_CONFIG = {
  firebase: {
    apiKey: "AIzaSyCnNcDX9Lfd_2yZAUrHSVGK2kz_GT3Pvko",
    authDomain: "runio-2d1fd.firebaseapp.com",
    projectId: "runio-2d1fd",
    storageBucket: "runio-2d1fd.firebasestorage.app",
    messagingSenderId: "717334757158",
    appId: "1:717334757158:web:af886dd5d4cf64f90a4be7"
  },

  // Where the map opens before the GPS finds you [latitude, longitude]
  defaultCenter: [50.9513, 1.8587],

  rules: {
    closeDistanceM: 30,     // come back within this distance of your start to close the loop
    minLoopLengthM: 200,    // minimum run length before a loop can close
    minAreaM2: 1000,        // smallest area you can claim (square meters)
    maxAreaM2: 2000000,     // biggest area you can claim (2 km2)
    maxSpeedKmh: 25,        // faster than this = not running (bike, car...) -> run cancelled
    maxAccuracyM: 35,       // GPS points less accurate than this are ignored
    minStepM: 5             // ignore moves smaller than this (GPS noise)
  },

  // Shows a "Simulation" checkbox to test at your desk without moving.
  // Set to false before opening the game to the public (otherwise people can cheat).
  allowSimulation: true
};
