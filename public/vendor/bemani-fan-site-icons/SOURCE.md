# BEMANI fan-site icons source

- Repository: <https://github.com/bicarus-dev/bemani_fan_site_icons>
- Revision: `225e494eebe3db5cd9b2ce04349b87606df97be3`
- Vendored subset: 22 browser-ready files for supported display modes:
  - beatmania IIDX: all 18 upstream arcade images for releases 18–33,
    including `ac_IIDX23_pre.png` and `ac_iidx24_loc.png`
  - GITADORA: `ac_gitadora_gw_delta.png`
  - SOUND VOLTEX: `ac_sdvx6.png` and `ac_sdvx7.jpg`
  - pop'n music: `ac_popn_highcheers.jpg`
- Omitted subset: every other upstream image—including INFINITAS and ULTIMATE
  MOBILE artwork—and `ico/`; the Nix build enforces the whitelist when
  constructing the deployable site

The upstream README is preserved as `UPSTREAM_README.md`. At the pinned
revision, the repository does not contain a license or other grant of rights.
It says the images were gathered from the KONAMI BEMANI fan site. This source
record and the project third-party notices do not grant permission to use or
redistribute the artwork.
