import { GlobalVerdict } from '../core/types';

const moodStyles: Record<GlobalVerdict['mood'], string> = {
  штиль: 'avatar--calm',
  напряжение: 'avatar--tense',
  шторм: 'avatar--storm'
};

const rankStyles: Record<GlobalVerdict['rank'], string> = {
  S: 'avatar--rank-s',
  A: 'avatar--rank-a',
  B: 'avatar--rank-b',
  C: 'avatar--rank-c',
  D: 'avatar--rank-d'
};

const getAvatarTone = (verdict: GlobalVerdict) => {
  if (verdict.isHighRisk || verdict.isHighUncertainty) {
    return {
      label: 'тревожный',
      face: '😰',
      phrase: 'Снижаем риск и укрепляем уверенность.'
    };
  }
  if (verdict.globalScore >= 75 && verdict.globalConfidence >= 70) {
    return {
      label: 'уверенный',
      face: '😎',
      phrase: 'Темп высокий — держим фокус.'
    };
  }
  return {
    label: 'собранный',
    face: '🙂',
    phrase: 'Ровный курс и контроль деталей.'
  };
};

const getMoodPhrase = (verdict: GlobalVerdict) => {
  if (verdict.mood === 'шторм') return 'Нужна стабилизация курса.';
  if (verdict.mood === 'напряжение') return 'Есть точки роста.';
  return 'Спокойное море и темп.';
};

export const createAvatar = (verdict: GlobalVerdict, level: number) => {
  const wrapper = document.createElement('div');
  wrapper.className = `avatar ${moodStyles[verdict.mood]} ${rankStyles[verdict.rank]}`;
  const tone = getAvatarTone(verdict);
  wrapper.innerHTML = `
    <span class="avatar-level">Lvl ${level}</span>
    <span class="avatar-face">${tone.face}</span>
    <span class="avatar-mark">Rank ${verdict.rank}</span>
    <span class="avatar-text">${tone.label}</span>
    <span class="avatar-phrase">${tone.phrase} ${getMoodPhrase(verdict)}</span>
  `;
  return wrapper;
};
