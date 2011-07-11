({
    baseUrl: "../../scripts/",
    paths: {
        "index": "../share/panel/index",
        "style": "../share/panel/style",
        "jquery": "jqueryStub",
        "widgets": "../share/panel/scripts/widgets"
    },
    name: "index",
    include: ['widgets/AccountPanelLinkedIn', 'widgets/AccountPanelFaceBook',
              'widgets/AccountPanelTwitter', 'ContactsEmail', 'ContactsTwitter',
              'ContactsLinkedIn', 'text!style.css', 'text!style/win.css',
              'text!style/mac.css', 'text!style/linux.css'],
    exclude: ['jquery', 'require/text'],
    out: './index.js'
})
