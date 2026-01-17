from setuptools import setup, find_packages

with open("requirements.txt") as f:
    install_requires = f.read().strip().split("\n")

setup(
    name="rustic_pos",
    version="0.0.1",
    description="POS customizations for ERPNext v15",
    author="Rustic",
    author_email="info@rustic.com",
    packages=find_packages(),
    zip_safe=False,
    include_package_data=True,
    install_requires=install_requires,
)
