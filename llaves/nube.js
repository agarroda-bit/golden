// LLAVES · datos compartidos del equipo en Supabase (UE). La seguridad está en el servidor (RLS por rol):
// esta capa solo pide y guarda; lo que un rol no puede ver, el servidor no lo devuelve.
// La sesión se guarda en la bóveda del aparato (cifrada con el PIN); sin la bóveda no hay sesión.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

let sb = null, CFG = null;
let destino = new Map(); // dónde guarda supabase-js la sesión: primero en memoria, luego en la bóveda
let boveda = null;
const PREF = 'llaves:';

// Almacén que entiende supabase-js. Escribe en la bóveda cuando ya está abierta.
const almacen = {
  getItem: (k) => (boveda ? boveda.leer(PREF + k) : destino.get(k) ?? null),
  setItem: (k, v) => { if (boveda) return boveda.guardar(PREF + k, v); destino.set(k, v); },
  removeItem: (k) => { if (boveda) return boveda.borrar(PREF + k); destino.delete(k); },
};

export function conectar(config) {
  CFG = config;
  sb = createClient(config.url, config.anon, { auth: { storage: almacen, storageKey: 'sesion', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } });
  return sb;
}
export const cliente = () => sb;

// Pasa la sesión de memoria a la bóveda (al crear o abrir el PIN)
export async function usarBoveda(b) {
  boveda = b;
  for (const [k, v] of destino) await b.guardar(PREF + k, v);
  destino = new Map();
}
export const hayBoveda = () => !!boveda;
export const leerCache = () => { try { return JSON.parse(boveda?.leer(PREF + 'cache') || 'null'); } catch { return null; } };
export const guardarCache = (d) => boveda?.guardar(PREF + 'cache', JSON.stringify(d));

// ---------- entrar ----------
export async function sesion() { const { data } = await sb.auth.getSession(); return data.session; }
export async function enviarAcceso(email) {
  const { error } = await sb.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true, emailRedirectTo: location.origin + location.pathname } });
  if (error) throw new Error(/rate|seconds/i.test(error.message) ? 'Has pedido muchos enlaces seguidos: espera un minuto.' : error.message);
}
export async function verificarCodigo(email, codigo) {
  const intentos = ['email', 'magiclink'];
  let ultimo;
  for (const type of intentos) {
    const { data, error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: codigo.trim(), type });
    if (!error && data.session) return data.session;
    ultimo = error;
  }
  throw new Error(ultimo?.message?.includes('expired') ? 'Ese código ha caducado: pide otro.' : 'Ese código no es válido.');
}
export async function entrar() {
  const { data, error } = await sb.rpc('entrar');
  if (error) throw new Error(error.message);
  return data;
}
export async function salir() { try { await sb.auth.signOut(); } catch {} for (const k of boveda?.nombres?.() || []) if (k.startsWith(PREF)) await boveda.borrar(k); }

const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

// ---------- radar ----------
export async function cargarRadar() {
  const [radar, pisos, mano, ajustes] = await Promise.all([
    sb.from('radar').select('datos, actualizado').maybeSingle().then(ok),
    todas(sb.from('pisos').select('id, datos')),
    sb.from('pisos_mano').select('id, datos, creado_por, creado').then(ok),
    sb.from('ajustes').select('datos').maybeSingle().then(ok),
  ]);
  return { ...(radar?.datos || {}), pisos: pisos.map((x) => x.datos), mano: mano.map((x) => ({ ...x.datos, id: x.id, creadoPor: x.creado_por })), ajustesEquipo: ajustes?.datos || {} };
}
// Todas las filas (Supabase devuelve como mucho 1.000 por petición)
async function todas(q) {
  const out = []; let desde = 0;
  for (;;) { const r = ok(await q.range(desde, desde + 999)); out.push(...r); if (r.length < 1000) return out; desde += 1000; }
}
export const guardarAjustesEquipo = (datos) => sb.from('ajustes').update({ datos, actualizado: new Date().toISOString() }).eq('id', 1).then(ok);
export const guardarMano = (p) => sb.from('pisos_mano').upsert({ id: p.id, datos: p }).then(ok);
export const borrarMano = (id) => sb.from('pisos_mano').delete().eq('id', id).then(ok);

// ---------- casos ----------
export const cargarCasos = () => sb.from('casos').select('*').order('creado').then(ok);
export const crearCaso = (fila) => sb.from('casos').insert(fila).select().single().then(ok);
export const guardarCaso = (id, cambios) => sb.from('casos').update(cambios).eq('id', id).select().single().then(ok);
export const borrarCaso = (id) => sb.from('casos').delete().eq('id', id).then(ok);

// ---------- perfil de contacto (solo dueño y negociador del caso; cada apertura queda registrada) ----------
export const abrirContacto = (caso) => sb.rpc('abrir_contacto', { c: caso }).then(ok);
export const guardarContacto = (caso, datos) => sb.rpc('guardar_contacto', { c: caso, datos }).then(ok);

// ---------- documentos (almacén privado documentos/<caso>/…) ----------
export const listarDocs = (caso) => sb.from('documentos').select('*').eq('caso_id', caso).order('creado', { ascending: false }).then(ok);
export async function subirDoc(caso, archivo, tipo) {
  const limpio = archivo.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').slice(-80);
  const ruta = `${caso}/${Date.now()}-${limpio}`;
  ok(await sb.storage.from('documentos').upload(ruta, archivo, { contentType: archivo.type || 'application/octet-stream', upsert: false }));
  return sb.from('documentos').insert({ caso_id: caso, nombre: archivo.name, tipo, ruta }).select().single().then(ok);
}
export const urlDoc = (ruta) => sb.storage.from('documentos').createSignedUrl(ruta, 120).then(ok).then((d) => d.signedUrl);
export async function borrarDoc(doc) { ok(await sb.from('documentos').delete().eq('id', doc.id)); await sb.storage.from('documentos').remove([doc.ruta]); }

// ---------- equipo (solo dueño; el servidor lo comprueba) ----------
export const miembros = () => sb.from('miembros').select('*').order('creado').then(ok);
export const invitaciones = () => sb.from('invitaciones').select('*').order('creado').then(ok);
export const invitar = (email, rol) => sb.rpc('invitar', { correo: email, nuevo_rol: rol }).then(ok);
export const cambiarRol = (id, rol) => sb.rpc('cambiar_rol', { miembro: id, nuevo_rol: rol }).then(ok);
export const quitarAcceso = (id) => sb.rpc('quitar_acceso', { miembro: id }).then(ok);
export const registro = (n = 200) => sb.from('registro').select('*').order('id', { ascending: false }).limit(n).then(ok);
export async function enlaceAcceso(email) {
  const { data, error } = await sb.functions.invoke('equipo', { body: { accion: 'enlace', email, volver: location.origin + location.pathname } });
  if (error) { let m = error.message; try { m = (await error.context.json()).error || m; } catch {} throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
