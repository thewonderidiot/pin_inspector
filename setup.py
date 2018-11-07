#!/usr/bin/env python

from distutils.core import setup

setup(
    name='agc_pins',
    version='1.2',
    description='AGC Backplane Pin Tool',
    author='Mike Stewart',
    author_email='mastewar1@gmail.com',
    url='',
    packages=['agc_pins'],
    include_package_data=True,
    zip_safe=False,
    install_requires=['Flask'],
)
