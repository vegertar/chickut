import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Plugins", "Escape", ["Base", "Newline"]);

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `\\!\\"\\#\\$\\%\\&\\'\\(\\)\\*\\+\\,\\-\\.\\/\\:\\;\\<\\=\\>\\?\\@\\[\\\\\\]\\^\\_\`\\{\\|\\}\\~\\
\\→\\A\\a\\ \\3\\φ\\«`,
};
