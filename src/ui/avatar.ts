import { GlobalVerdict } from '../core/types';

const moodStyles: Record<GlobalVerdict['mood'], string> = {
  штиль: 'avatar--calm',
  напряжение: 'avatar--tense',
  шторм: 'avatar--storm'
};

const getMoodPhrase = (verdict: GlobalVerdict) => {
  if (verdict.mood === 'шторм') return 'Нужна стабилизация курса.';
  if (verdict.mood === 'напряжение') return 'Есть точки роста.';
  return 'Спокойное море и темп.';
};

export const createAvatar = (verdict: GlobalVerdict, level: number) => {
  const wrapper = document.createElement('div');
  wrapper.className = `avatar ${moodStyles[verdict.mood]}`;
  wrapper.innerHTML = `
    <span class="avatar-level">Lvl ${level}</span>
    <span class="avatar-mark">${verdict.rank}</span>
    <span class="avatar-text">${verdict.mood}</span>
    <span class="avatar-phrase">${getMoodPhrase(verdict)}</span>
  `;
  return wrapper;
};
