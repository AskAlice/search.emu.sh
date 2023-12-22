import * as process from 'process';
import otelSDK from './tracing';
otelSDK.start();

import start from './start';
start(otelSDK);


    export { default as app, default } from './app';

