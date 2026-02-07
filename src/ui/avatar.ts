export const createAvatar = () => {
  const wrapper = document.createElement('div');
  wrapper.className = 'avatar';
  wrapper.innerHTML = '<span>LS</span>';
  return wrapper;
};
