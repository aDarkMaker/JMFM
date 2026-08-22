/// <reference types="node" />
import {getDefaultConfig, mergeConfig} from '@react-native/metro-config';

const config = {};

export default mergeConfig(getDefaultConfig(__dirname), config);
