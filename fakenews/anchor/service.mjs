import {createAnchorPump} from './automation.mjs';
import {activeControllers} from '../../newsroom/anchor/gpu.mjs';
// Separate queue and publishing destination; shared GPU lease with IN / SIGNAL.
const pump=createAnchorPump({busy:activeControllers});
await pump.tick();
setInterval(()=>{},60000);
