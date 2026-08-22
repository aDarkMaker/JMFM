/**
 * Entry point of the app.
 * Registers the root component with the native runtime.
 */
import 'react-native-gesture-handler';
import {AppRegistry} from 'react-native';
import App from './src/app/App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
