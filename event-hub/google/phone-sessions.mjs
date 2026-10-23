import {assert} from '../core.mjs';
import {normalizeMalaysiaPhone} from '../phone.mjs';
// User explicitly chose phone-only access. No ownership verification is implied.
export class PhoneSessions {
  constructor({cache,digest,randomToken,now,enabled,members}){Object.assign(this,{cache,digest,randomToken,now,enabled,members});}
  key(value){return 'hub:'+this.digest(value);}
  login(input){assert(this.enabled,'手机号登录尚未开放',503);const phone=normalizeMalaysiaPhone(input),key=this.key('attempt:'+phone),old=JSON.parse(this.cache.get(key)||'{}');
    const attempts=this.now-old.at<60000?Number(old.count||0)+1:1;
    assert(attempts<=10,'尝试次数过多，请稍后再试',429);this.cache.put(key,JSON.stringify({at:this.now,count:attempts}),60);
    const matches=this.members.filter(user=>user.phone===phone&&user.active===true&&user.loginStatus==='phone_only');assert(matches.length===1,'手机号未登记或账号未启用',403);
    const token=this.randomToken(),expiresAt=this.now+6*3600000;
    this.cache.put(this.key('session:'+token),JSON.stringify({userId:matches[0].userId,expiresAt}),21600);
    return {token,expiresAt};
  }
  actor(token){assert(this.enabled,'手机号登录未开放',503);assert(typeof token==='string'&&token.length>=32&&token.length<=200,'请先登录',401);
    const session=JSON.parse(this.cache.get(this.key('session:'+token))||'null');assert(session&&session.expiresAt>this.now,'登录已过期，请重新登录',401);
    assert(this.members.some(user=>user.userId===session.userId&&user.active===true&&user.loginStatus==='phone_only'),'账号已停用',403);return session.userId;
  }
  logout(token){if(typeof token==='string'&&token.length<=200)this.cache.remove(this.key('session:'+token));return {ok:true};}
}
