import client, { payloadFrom } from './client.js';

export async function getProfile() {
  return payloadFrom(await client.get('/users/me'));
}

export async function updateProfile(profile) {
  return payloadFrom(await client.patch('/users/me', profile));
}

const userApi = { getProfile, updateProfile };
export default userApi;
