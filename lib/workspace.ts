export type WorkspaceSettings = {
 agencyName: string;
 logoDataUrl: string;
 theme: 'light' | 'dark' | 'system';
 primaryColor: string;
 accentColor: string;
 dashboardType: 'operational' | 'analytical' | 'intelligent';
};
export const DEFAULT_WORKSPACE: WorkspaceSettings = { agencyName: '', logoDataUrl: '', theme: 'light', primaryColor: '#2f5bea', accentColor: '#58a78a', dashboardType: 'operational' };
export function foregroundColor(hex: string) {
 const rgb = hex.slice(1).match(/.{2}/g)?.map(value => { const channel = parseInt(value, 16) / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4; }) || [0, 0, 0];
 return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2] > .179 ? '#101828' : '#ffffff';
}
