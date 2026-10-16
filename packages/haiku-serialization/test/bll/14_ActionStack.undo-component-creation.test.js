const tape = require('tape');
const path = require('path');
const fse = require('haiku-fs-extra');
const Project = require('../../src/bll/Project');

// Regression test for upstream issue #1089: undo did nothing after creating a component, because the undoable is
// recorded on the parent component while the editor immediately switches into the new component.
tape('ActionStack: undo reverses component creation from inside the new component', (t) => {
  const folder = path.join(__dirname, '..', 'fixtures', 'projects', 'actionstack-undo-component-creation');
  fse.removeSync(folder);

  const websocket = {on: () => {}, send: () => {}, action: () => {}, connect: () => {}};
  const fileOptions = {doWriteToDisk: true, skipDiffLogging: true};
  const envoyOptions = {mock: true};

  Project.setup(folder, 'test', websocket, {}, {}, fileOptions, envoyOptions, (setupErr, project) => {
    t.error(setupErr, 'project set up');

    project.setCurrentActiveComponent('main', {from: 'test'}, (mainErr) => {
      t.error(mainErr, 'main component active');
      fse.outputFileSync(path.join(folder, 'designs/Rect.svg'), RECT_SVG);
      const parent = project.getCurrentActiveComponent();

      parent.instantiateComponent('designs/Rect.svg', undefined, {from: 'test'}, (instantiateErr) => {
        t.error(instantiateErr, 'rect instantiated');
        const elementId = parent.getReifiedBytecode().template.children[0].attributes['haiku-id'];
        const beforeCreation = parent.getBytecodeJSON();

        parent.conglomerateComponent(
          [elementId],
          'card',
          {x: 79, y: 79},
          {x: 0, y: 0},
          {x: 39.5, y: 39.5},
          {'sizeMode.x': 1, 'sizeMode.y': 1, 'sizeMode.z': 1, 'origin.x': 0.5, 'origin.y': 0.5},
          {},
          {from: 'test'},
          (createErr, created) => {
            t.error(createErr, 'component created');
            t.notEqual(parent.getBytecodeJSON(), beforeCreation, 'parent now holds the new component');

            // Like Glass, open the new component for editing right away.
            created.setAsCurrentActiveComponent({from: 'test'}, (switchErr) => {
              t.error(switchErr, 'switched into the new component');
              t.equal(project.getCurrentActiveComponent().getSceneName(), 'card', 'editing the new component');

              setTimeout(() => {
                project.actionStack.shiftAndProcessLatestAction();
                project.undo({}, {from: 'test'}, (undoErr) => {
                  t.error(undoErr, 'undo ran');
                  // The snapshot restore materializes timeline values as attributes, so compare structure, not JSON.
                  const restored = parent.getReifiedBytecode().template.children;
                  t.equal(restored.length, 1, 'parent has one child again');
                  t.equal(restored[0].attributes['haiku-id'], elementId, 'the original element is back');
                  t.notOk(/code\/card\/code/.test(parent.getBytecodeJSON()), 'no instance of the created component');
                  t.notOk(project.findActiveComponentBySceneName('card'), 'the created component is gone');
                  t.equal(project.getCurrentActiveComponent().getSceneName(), 'main', 'editor is back in the parent');
                  fse.removeSync(folder);
                  t.end();
                });
              });
            });
          },
        );
      });
    });
  });
});

const RECT_SVG = `
  <?xml version="1.0" encoding="UTF-8"?>
  <svg width="79px" height="79px" viewBox="0 0 79 79" version="1.1" xmlns="http://www.w3.org/2000/svg">
    <rect id="Rectangle" fill="#420000" x="0" y="0" width="79" height="79"></rect>
  </svg>
`;
