// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	integrations: [
		starlight({
			title: '開發環境手冊',
			customCss: ['./src/styles/custom.css'],
			head: [
				{
					// Open links to other sites in a new tab; links within the book stay in the same tab.
					tag: 'script',
					content: `document.addEventListener('DOMContentLoaded', () => {
	for (const a of document.querySelectorAll('.sl-markdown-content a[href]')) {
		if (a.host !== location.host) {
			a.target = '_blank';
			a.rel = 'noopener noreferrer';
		}
	}
});`,
				},
			],
			defaultLocale: 'root',
			locales: {
				root: { label: '繁體中文', lang: 'zh-TW' },
			},
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/gbaian10/dev-handbook' }],
			sidebar: [
				{
					label: '裝機',
					items: [
						{ label: '新電腦從零開始', slug: 'setup/new-machine' },
						{ label: '用 chezmoi 管理 dotfiles', slug: 'setup/chezmoi' },
						{ label: 'Docker 與 GPU', slug: 'setup/docker' },
						{ label: 'alias 與 zfunc', slug: 'setup/zsh-custom' },
						{ label: '換電腦要手動帶走的東西', slug: 'setup/migrate' },
					],
				},
				{
					// 背景知識：說明為什麼這樣分工，不是照著做的步驟。網址仍在 setup/ 底下，連結不用改
					label: '背景知識',
					items: [
						{ label: '安裝分工', slug: 'setup/install-strategy' },
						{ label: '語言版本管理', slug: 'setup/languages' },
						{ label: 'PATH 擺法', slug: 'setup/path' },
						{ label: 'ssh 設定', slug: 'setup/ssh' },
					],
				},
				{
					label: 'git',
					items: [
						{ label: 'git 設定', slug: 'git/config' },
						{ label: '全域 pre-commit hook', slug: 'git/global-hooks' },
					],
				},
			],
		}),
	],
});
