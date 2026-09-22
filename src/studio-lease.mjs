import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
export const studioLeaseFile=()=>process.env.NOVA_STUDIO_LEASE_FILE||path.join(process.env.LOCALAPPDATA||os.homedir(),'NovaConductor','studio-lease.json');
export const studioBusy=()=>fs.existsSync(studioLeaseFile());
export function assertStudioIdle(){if(studioBusy())throw Error('The news studio has reserved inference hardware. Wait for rendering and model restoration to finish.');}
