import {Instagram} from '../social/instagram.mjs';

// Same durable delivery state machine as photos; only container creation differs.
// Reference: Meta's Instagram API collection, Reels Publishing.
export class InstagramReels extends Instagram {
  create(caption,videoUrl){
    const url=new URL(videoUrl);
    if(url.protocol!=='https:')throw Error('Reels require a public HTTPS video URL');
    return this.request(this.accountId+'/media',{media_type:'REELS',video_url:url.href,caption,share_to_feed:'true',thumb_offset:'1000'},'POST');
  }
}
