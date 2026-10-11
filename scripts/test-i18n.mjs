import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { english, translate } from '../lib/translations.ts';
assert.equal(translate('en','学习空间'), 'Study Space');
assert.equal(translate('zh','Study Space'), '学习空间');
assert.equal(translate('en','第 {0} 章', {'0':12}), 'Chapter 12');
assert.equal(translate('en','第 12 章'), 'Chapter 12');
assert.equal(translate('zh','Chapter 12'), '第 12 章');
assert.equal(translate('en','删除课程“{0}”？', {'0':'数据库原理'}), 'Delete “数据库原理”?');
assert.equal(translate('en',' 数据库原理 '), ' 数据库原理 ');
assert.equal(translate('en','  学习空间  '), '  Study Space  ');
assert.equal(translate('en',' '), ' ');
assert.equal(translate('en','用户名或密码不正确'), 'Incorrect username or password');
assert.match(translate('en','密码需要 9–128 个字符，建议使用长口令；不要使用其他网站的密码'), /9–128/);
const pages = ['app/login/auth-screen.tsx','app/account/account-center.tsx','components/account-actions.tsx','app/library-app.tsx','app/study/[courseId]/[chapter]/study-workspace.tsx','components/document-viewer.tsx','components/pdf-viewer.tsx','app/bulk-import/bulk-importer.tsx'];
for (const file of pages) {
  const ast = ts.createSourceFile(file, fs.readFileSync(file,'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 't' && ts.isStringLiteral(node.arguments[0]) && /[\u3400-\u9fff]/.test(node.arguments[0].text)) {
      assert.ok(english[node.arguments[0].text.trim()], `${file}: missing translation for ${node.arguments[0].text}`);
    }
    ts.forEachChild(node,visit);
  }
  visit(ast);
}
console.log('Translation checks passed: UI keys, placeholders, API errors, language reversal and original course names.');
