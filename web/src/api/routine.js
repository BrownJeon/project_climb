import { client } from './client';

export const routineApi = {
  list: () => client.get('/training/routines'),
  create: (body) => client.post('/training/routines', body),
  update: (id, body) => client.patch(`/training/routines/${id}`, body),
  remove: (id) => client.delete(`/training/routines/${id}`),
};
