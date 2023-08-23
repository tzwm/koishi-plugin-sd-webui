import { h, Context, Schema, Bot } from 'koishi';
import sdwebui, { Client, SamplingMethod } from 'node-sd-webui';
import * as lark from '@larksuiteoapi/node-sdk';


export const name = 'sd-webui';

export interface Config {
  webuiHost: string;
  webuiUser: string;
  webuiPass: string;
}

export const Config: Schema<Config> = Schema.object({
  webuiHost: Schema.string().required(),
  webuiUser: Schema.string().required(),
  webuiPass: Schema.string().required(),
})

export async function apply(ctx: Context, config: Config) {
  const sdClient: Client = sdwebui({ apiUrl: config.webuiHost });
  //const tmp = await loginSDWebUI(sdClient, config);

  ctx.command('sd.imagine <prompt:string>')
    .action((argv, prompt) => sdTxt2ImgCallback(argv, prompt, sdClient));
  ctx.command('sd.tagger')
    .action((argv) => taggerInterrogateCallback(argv, sdClient));
}

export async function sdTxt2ImgCallback(argv: any, prompt: string, sdClient: Client) {
  const session = argv.session;
  const replyFunc = generateReplyFunc(
    session.messageId,
    session.send.bind(session),
  );

  const image = await txt2imgBase64(prompt, sdClient);
  replyFunc(h.image(Buffer.from(image, "base64"), 'image/png'));
};

export async function taggerInterrogateCallback(argv: any, sdClient: Client) {
  const session = argv.session;
  const replyFunc = generateReplyFunc(
    session.messageId,
    session.send.bind(session),
  ); await replyFunc('请输入图片：'); const imageInput = await session.prompt();
  //{"image_key":"img_v2_3235a608-108e-4356-b076-2be219dd600g"}
  if (!imageInput) {
    replyFunc('输入超时。');
    return;
  }

  const match = imageInput.match(/url="(.*?)"/); if (!match) { replyFunc('无法解析');
    return;
  }
  const imageUrl = match[1];
  const imageBuffer = await getImageBufferByUrl(imageUrl);
  const imageBase64 = imageBuffer.toString("base64");
  const taggers = await taggerInterrogate(imageBase64, sdClient);

  return replyFunc(Object.keys(taggers).join(", "));
}

async function taggerInterrogate(imageBase64: string, sdClient: Client) {
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

async function txt2imgBase64(prompt: string, sdClient: Client) {
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

function generateReplyFunc(messageId: string, sendFunc: Function) {
  return async (content: string | Element) => {
    await sendFunc([h.quote(messageId), content]);
  };
};

async function getImageBufferByUrl(url: string) {
  const response = await fetch(url);
  return Buffer.from(await response.arrayBuffer());
};

async function getImageByLarkImageKey(messageId: string, imageKey: string, config: Config) {
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

async function loginSDWebUI(client: Client, config: Config) {
  if (!(config.webuiUser && config.webuiPass)) {
    return true;
  }

  const endpoint = '/login/';
  const body = {
    "username": config.webuiUser,
    "password": config.webuiPass,
  };

  const response = await fetch(`${client.apiUrl}${endpoint}`, {
    method: 'POST',
    body: new URLSearchParams(body).toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    },
  });

  const ret = await response.json();

  if (ret.success) {
    return true;
  } else {
    return false;
  }
}
