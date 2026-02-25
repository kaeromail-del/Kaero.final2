import api from './api';

export const categoryService = {
  async getAll() {
    const { data } = await api.get('/categories');
    return data.categories;
  },
  async getChildren(parentId: number) {
    const { data } = await api.get(`/categories/${parentId}/children`);
    return data.categories;
  },
};
