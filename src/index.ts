import { h, Context, Schema } from 'koishi';
import sdwebui, { Client } from 'node-sd-webui';
import { decode } from 'html-entities';
import {
  taggerInterrogate,
  txt2imgBase64,
  generateReplyFunc,
  getImageBufferByUrl,
  getImageByLarkImageKey,
} from './utils';

export const name = 'sd-webui';

export interface Config {
  webuiHost: string;
}

export const Config: Schema<Config> = Schema.object({
  webuiHost: Schema.string(),
})

export let sdClient: Client;

export async function apply(ctx: Context, config: Config) {
  sdClient = sdwebui({ apiUrl: config.webuiHost });

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

  prompt = decode(prompt);
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

