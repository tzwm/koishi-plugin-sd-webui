import { h } from 'koishi';
import { Client, SamplingMethod } from 'node-sd-webui';
import { Config } from './index';
import * as lark from '@larksuiteoapi/node-sdk';

export async function taggerInterrogate(imageBase64: string, sdClient: Client) {
  const endpoint = '/tagger/v1/interrogate';
  const body = {
    "image": imageBase64,
    "model": "wd14-vit-v2-git",
    "threshold": 0.35,
  };

  console.time("sd - tagger interrogate");
  const response = await fetch(`${sdClient.apiUrl}${endpoint}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  });
  console.timeEnd("sd - tagger interrogate");

  const ret = await response.json();

  return ret['caption'];
}

export async function txt2imgBase64(prompt: string, sdClient: Client) {
  const { images } = await sdClient.txt2img({
    prompt: prompt,
    negativePrompt: 'EasyNegative',
    samplingMethod: SamplingMethod.DPMPlusPlus_2M_Karras,
    width: 512,
    height: 512,
    steps: 20,
    batchSize: 1,
    extensions: {
      //AnimateDiff: {
        //"args": [true],
      //},
    },
  });

  return images[0];
}

export function generateReplyFunc(messageId: string, sendFunc: Function) {
  return async (content: string | Element) => {
    await sendFunc([h.quote(messageId), content]);
  };
};

export async function getImageBufferByUrl(url: string) {
  const response = await fetch(url);
  return Buffer.from(await response.arrayBuffer());
};

export async function getImageByLarkImageKey(messageId: string, imageKey: string, config: Config) {
  if (config['platform'] != 'feishu') {
    return;
  }

  const client = new lark.Client({
    appId: config['appId'],
    appSecret: config['appSecret'],
  });
  const image = await client.im.messageResource.get({
    params: {
      type: 'image',
    },
    path: {
      message_id: messageId,
      file_key: imageKey,
    },
  });

  return image;
};
