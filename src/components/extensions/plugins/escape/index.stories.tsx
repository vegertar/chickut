import Extension from "./index";
import { meta, template } from "../../index.stories";
import Base from "../../nodes/base";
import Newline from "../../nodes/newline";

export default meta("Plugins", Extension, [Base, Newline]);

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `\\!\\"\\#\\$\\%\\&\\'\\(\\)\\*\\+\\,\\-\\.\\/\\:\\;\\<\\=\\>\\?\\@\\[\\\\\\]\\^\\_\`\\{\\|\\}\\~\\
\\→\\A\\a\\ \\3\\φ\\«`,
};
