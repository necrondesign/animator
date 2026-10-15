import * as React from 'react';
import {ISSUES_URL, PRODUCT_NAME, REPOSITORY_URL} from 'haiku-common/lib/branding';

export default function ({styles, openLink}) {
  return (
    <div>
      <h2 style={styles.heading}>That’s a wrap!</h2>
      <div style={styles.text}>
        Now it's your turn to build something awesome using {PRODUCT_NAME}. You can <strong>check out the following resources</strong> to help you kick-start your first project:

        <div style={styles.linksWrapper}>
          - <a onClick={openLink} href={REPOSITORY_URL} style={styles.link}>Source code and documentation</a> <br />
          - <a onClick={openLink} href={ISSUES_URL} style={styles.link}>Report a problem or ask a question</a>
        </div>
      </div>
    </div>
  );
}
