export * from './utils';
export * from './engine';
import { createBlazion } from './instance';
export { createBlazion };

const blazion = createBlazion({ baseURL: '' });
export default blazion;