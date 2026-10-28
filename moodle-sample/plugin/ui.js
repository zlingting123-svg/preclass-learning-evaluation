/* Progressive enhancement only: all persistence and permissions remain server-side. */
(() => {
    'use strict';
    const init = () => {
        const root = document.querySelector('.pcs-app');
        if (!root) return;
        const form = root.querySelector('#pcs-profile-form');
        if (form) {
            const fingerprint = () => JSON.stringify([...new FormData(form).entries()].filter(([key]) => key !== 'sesskey'));
            const initial = fingerprint();
            let dirty = form.dataset.unsaved === 'true';
            let submitting = false;
            const state = form.querySelector('[data-save-state]');
            const savedLabel = state.textContent;
            const questions = [...form.querySelectorAll('[data-editable="true"]')];
            const update = () => {
                let count = 0;
                questions.forEach(question => {
                    const filled = [...question.querySelectorAll('textarea, select, input')].some(input =>
                        input.type === 'checkbox' ? input.checked : input.value.trim() !== '');
                    if (filled) count++;
                    const link = form.querySelector(`[data-nav-question="${question.dataset.question}"]`);
                    link.classList.toggle('pcs-nav-filled', filled);
                });
                form.querySelector('[data-progress]').value = count;
                form.querySelector('[data-progress-text]').textContent = `已填写 ${count} / ${questions.length} 题`;
                dirty = form.dataset.unsaved === 'true' || fingerprint() !== initial;
                state.textContent = dirty ? '有修改尚未保存' : savedLabel;
                state.classList.toggle('pcs-unsaved', dirty);
            };
            form.addEventListener('input', update);
            form.addEventListener('change', update);
            form.addEventListener('submit', () => { submitting = true; });
            window.addEventListener('beforeunload', event => {
                if (dirty && !submitting) { event.preventDefault(); event.returnValue = ''; }
            });
            window.addEventListener('pageshow', () => { submitting = false; update(); });
            const navigation = form.querySelector('.pcs-question-nav');
            if (window.matchMedia('(max-width: 760px)').matches) navigation.open = false;
            navigation.addEventListener('click', event => {
                if (event.target.closest('a') && window.matchMedia('(max-width: 760px)').matches) navigation.open = false;
            });
            update();
        }
        const courseTools = root.querySelector('[data-course-tools]');
        if (courseTools) {
            courseTools.hidden = false;
            const cards = [...root.querySelectorAll('[data-course-card]')];
            const search = courseTools.querySelector('[data-course-search]');
            const category = courseTools.querySelector('[data-course-category]');
            const reset = root.querySelector('[data-course-reset]');
            const filter = () => {
                const term = search.value.trim().toLocaleLowerCase();
                let shown = 0;
                cards.forEach(card => {
                    card.hidden = !card.dataset.name.toLocaleLowerCase().includes(term) || (category.value !== '' && card.dataset.category !== category.value);
                    if (!card.hidden) shown++;
                });
                courseTools.querySelector('[data-course-count]').textContent = `显示 ${shown} / ${cards.length} 门课程`;
                root.querySelector('[data-course-empty]').hidden = shown > 0;
                reset.hidden = !(search.value || category.value);
            };
            search.addEventListener('input', filter); category.addEventListener('change', filter);
            reset.addEventListener('click', () => { search.value = ''; category.value = ''; filter(); search.focus(); });
            filter();
        }
        const reportTools = root.querySelector('[data-report-tools]');
        if (reportTools) {
            reportTools.hidden = false;
            const rows = [...root.querySelectorAll('[data-report-row]')];
            const search = reportTools.querySelector('[data-report-search]');
            const expand = reportTools.querySelector('[data-expand-reports]');
            const visibleDetails = () => rows.filter(row => !row.hidden).map(row => row.querySelector('details'));
            const updateToggle = () => {
                const details = visibleDetails();
                expand.disabled = details.length === 0;
                const allOpen = details.length > 0 && details.every(detail => detail.open);
                expand.textContent = allOpen ? '收起全部答卷' : '展开全部答卷';
            };
            const filter = () => {
                const term = search.value.trim().toLocaleLowerCase(); let shown = 0;
                rows.forEach(row => { row.hidden = !row.dataset.search.toLocaleLowerCase().includes(term); if (!row.hidden) shown++; });
                reportTools.querySelector('[data-report-count]').textContent = `显示 ${shown} / ${rows.length} 份草稿`;
                root.querySelector('[data-report-empty]').hidden = shown > 0;
                updateToggle();
            };
            search.addEventListener('input', filter);
            expand.addEventListener('click', () => {
                const details = visibleDetails(); const open = !details.every(detail => detail.open);
                details.forEach(detail => { detail.open = open; }); updateToggle();
            });
            rows.forEach(row => row.querySelector('details').addEventListener('toggle', updateToggle));
            filter();
        }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
