import { GlobalVerdict } from '../core/types';

const moodStyles: Record<GlobalVerdict['mood'], string> = {
  штиль: 'avatar--calm',
  напряжение: 'avatar--tense',
  шторм: 'avatar--storm'
};

export const createAvatar = (verdict: GlobalVerdict) => {
  const wrapper = document.createElement('div');
  wrapper.className = `avatar ${moodStyles[verdict.mood]}`;
  wrapper.innerHTML = `
    <span class="avatar-mark">${verdict.rank}</span>
    <span class="avatar-text">${verdict.mood}</span>
  `;
  return wrapper;
};
